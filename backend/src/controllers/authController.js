import bcrypt from 'bcrypt';
import User from '../models/User.js';
import Log from '../models/Log.js';
import generateToken from '../utils/generateToken.js';
import { generateRsaKeyPair, encryptPrivateKey } from '../utils/cryptoUtils.js';

export const registerUser = async (req, res) => {
  const { username, email, password } = req.body;

  try {
    const userExists = await User.findOne({ email });

    if (userExists) {
      return res.status(400).json({ message: 'User already exists' });
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    // Generate RSA Keys for the user
    const { publicKey, privateKey } = generateRsaKeyPair();

    // Encrypt Private Key for safe DB storage (Option A)
    const encryptedPrivateKey = encryptPrivateKey(privateKey);

    const user = await User.create({
      username,
      email,
      passwordHash,
      publicKey,
      encryptedPrivateKey,
      role: 'user', // first user could be admin manually, or check users length
    });

    if (user) {
      await Log.create({
        userId: user._id,
        action: 'REGISTER',
        details: { email: user.email },
      });

      res.status(201).json({
        _id: user._id,
        username: user.username,
        email: user.email,
        role: user.role,
        publicKey: user.publicKey,
        token: generateToken(user._id),
      });
    } else {
      res.status(400).json({ message: 'Invalid user data' });
    }
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const loginUser = async (req, res) => {
  const { email, password } = req.body;

  try {
    const user = await User.findOne({ email });

    if (user && (await bcrypt.compare(password, user.passwordHash))) {
      await Log.create({
        userId: user._id,
        action: 'LOGIN',
        details: { ip: req.ip },
      });

      res.json({
        _id: user._id,
        username: user.username,
        email: user.email,
        role: user.role,
        publicKey: user.publicKey,
        token: generateToken(user._id),
      });
    } else {
      // Log failed attempt
      if (user) {
        await Log.create({
          userId: user._id,
          action: 'FAILED_LOGIN',
          details: { ip: req.ip },
        });
      }
      res.status(401).json({ message: 'Invalid email or password' });
    }
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
