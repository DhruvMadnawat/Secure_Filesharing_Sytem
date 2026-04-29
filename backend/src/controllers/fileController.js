import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import File from '../models/File.js';
import User from '../models/User.js';
import Log from '../models/Log.js';
import { 
  encryptBufferWithAes, 
  decryptBufferWithAes, 
  encryptAesKeyWithRsa, 
  decryptAesKeyWithRsa, 
  decryptPrivateKey 
} from '../utils/cryptoUtils.js';

const UPLOADS_DIR = path.join(process.cwd(), 'uploads');

// Ensure uploads directory exists
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

export const uploadFile = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded' });
    }

    const { originalname, buffer, mimetype } = req.file;
    const user = req.user;

    // 1. Encrypt the file buffer with AES
    const { encryptedBuffer, aesKey } = encryptBufferWithAes(buffer);

    // 2. Encrypt the AES key with the User's RSA Public Key
    const encryptedAesKey = encryptAesKeyWithRsa(aesKey, user.publicKey);

    // 3. Save the encrypted buffer to disk
    const storedName = uuidv4();
    const filePath = path.join(UPLOADS_DIR, storedName);
    fs.writeFileSync(filePath, encryptedBuffer);

    // 4. Save metadata to DB
    const newFile = await File.create({
      filename: originalname,
      storedName,
      mimeType: mimetype,
      ownerId: user._id,
      accessList: [
        {
          userId: user._id,
          encryptedAesKey,
        }
      ]
    });

    await Log.create({
      userId: user._id,
      action: 'UPLOAD',
      details: { fileId: newFile._id, filename: newFile.filename },
    });

    res.status(201).json({ message: 'File uploaded securely', file: newFile });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: error.message });
  }
};

export const downloadFile = async (req, res) => {
  try {
    const { fileId } = req.params;
    const user = req.user;

    const file = await File.findById(fileId);
    if (!file) {
      return res.status(404).json({ message: 'File not found' });
    }

    // Check Access Control
    const accessEntry = file.accessList.find(entry => entry.userId.toString() === user._id.toString());
    if (!accessEntry) {
      await Log.create({
        userId: user._id,
        action: 'UNAUTHORIZED_ACCESS',
        details: { fileId: file._id, reason: 'Attempted to download without access' }
      });
      return res.status(403).json({ message: 'Access denied' });
    }

    // 1. Retrieve and decrypt the user's private key (using the server side stored symmetric key method)
    const privateKeyPem = decryptPrivateKey(user.encryptedPrivateKey);

    // 2. Decrypt the AES key using the user's RSA private key
    let aesKey;
    try {
      aesKey = decryptAesKeyWithRsa(accessEntry.encryptedAesKey, privateKeyPem);
    } catch (e) {
      return res.status(500).json({ message: 'Failed to decrypt AES key. Key mismatch or corruption.' });
    }

    // 3. Read encrypted file from disk
    const filePath = path.join(UPLOADS_DIR, file.storedName);
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ message: 'Encrypted file not found on server' });
    }
    const encryptedBuffer = fs.readFileSync(filePath);

    // 4. Decrypt the file buffer
    const decryptedBuffer = decryptBufferWithAes(encryptedBuffer, aesKey);

    await Log.create({
      userId: user._id,
      action: 'DOWNLOAD',
      details: { fileId: file._id }
    });

    // 5. Send file to client
    res.setHeader('Content-Disposition', `attachment; filename="${file.filename}"`);
    res.setHeader('Content-Type', file.mimeType || 'application/octet-stream');
    res.send(decryptedBuffer);

  } catch (error) {
    console.error(error);
    res.status(500).json({ message: error.message });
  }
};

export const listFiles = async (req, res) => {
  try {
    const user = req.user;

    // Find all files where the user is the owner OR in the access list
    const files = await File.find({
      $or: [
        { ownerId: user._id },
        { 'accessList.userId': user._id }
      ]
    }).populate('ownerId', 'username email');

    res.json(files);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: error.message });
  }
};

export const shareFile = async (req, res) => {
  try {
    const { fileId } = req.params;
    const { targetEmail } = req.body;
    const user = req.user;

    const file = await File.findById(fileId);
    if (!file) return res.status(404).json({ message: 'File not found' });

    if (file.ownerId.toString() !== user._id.toString()) {
      return res.status(403).json({ message: 'Only the owner can share this file' });
    }

    const targetUser = await User.findOne({ email: targetEmail });
    if (!targetUser) return res.status(404).json({ message: 'Target user not found' });

    // Check if already shared
    if (file.accessList.some(entry => entry.userId.toString() === targetUser._id.toString())) {
      return res.status(400).json({ message: 'File is already shared with this user' });
    }

    // Decrypt the AES key for the owner
    const ownerAccessEntry = file.accessList.find(entry => entry.userId.toString() === user._id.toString());
    const ownerPrivateKeyPem = decryptPrivateKey(user.encryptedPrivateKey);
    const aesKey = decryptAesKeyWithRsa(ownerAccessEntry.encryptedAesKey, ownerPrivateKeyPem);

    // Re-encrypt the AES key using the Target User's RSA Public Key
    const newEncryptedAesKey = encryptAesKeyWithRsa(aesKey, targetUser.publicKey);

    // Add to access list
    file.accessList.push({
      userId: targetUser._id,
      encryptedAesKey: newEncryptedAesKey
    });

    await file.save();

    await Log.create({
      userId: user._id,
      action: 'SHARE',
      details: { fileId: file._id, targetUserId: targetUser._id }
    });

    res.json({ message: 'File shared successfully' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: error.message });
  }
};
