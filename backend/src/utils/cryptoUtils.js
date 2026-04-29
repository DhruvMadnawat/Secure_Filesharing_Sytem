import crypto from 'crypto';
import dotenv from 'dotenv';
dotenv.config();

const ENCRYPTION_ALGORITHM = 'aes-256-cbc';
const IV_LENGTH = 16;
const SYMMETRIC_KEY_LENGTH = 32; // 256 bits

// --- AES Encryption for Files ---

/**
 * Encrypt a buffer with AES-256-CBC
 * @param {Buffer} buffer - The data to encrypt
 * @returns {Object} { encryptedBuffer, aesKey }
 */
export const encryptBufferWithAes = (buffer) => {
  const aesKey = crypto.randomBytes(SYMMETRIC_KEY_LENGTH);
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ENCRYPTION_ALGORITHM, aesKey, iv);
  
  const encrypted = Buffer.concat([cipher.update(buffer), cipher.final()]);
  
  // Combine IV and encrypted data
  const encryptedBufferWithIv = Buffer.concat([iv, encrypted]);
  return { encryptedBuffer: encryptedBufferWithIv, aesKey };
};

/**
 * Decrypt a buffer with AES-256-CBC
 * @param {Buffer} encryptedBufferWithIv - IV + Encrypted Data
 * @param {Buffer} aesKey - The AES key used to encrypt
 * @returns {Buffer} - Decrypted data
 */
export const decryptBufferWithAes = (encryptedBufferWithIv, aesKey) => {
  const iv = encryptedBufferWithIv.subarray(0, IV_LENGTH);
  const encryptedData = encryptedBufferWithIv.subarray(IV_LENGTH);
  const decipher = crypto.createDecipheriv(ENCRYPTION_ALGORITHM, aesKey, iv);
  
  return Buffer.concat([decipher.update(encryptedData), decipher.final()]);
};


// --- RSA Encryption for AES Keys ---

/**
 * Generate a new RSA Key Pair
 * @returns {Object} { publicKey, privateKey } as PEM strings
 */
export const generateRsaKeyPair = () => {
  const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicKeyEncoding: {
      type: 'spki',
      format: 'pem',
    },
    privateKeyEncoding: {
      type: 'pkcs8',
      format: 'pem',
    },
  });
  return { publicKey, privateKey };
};

/**
 * Encrypt AES Key with RSA Public Key
 * @param {Buffer} aesKey
 * @param {String} publicKeyPem
 * @returns {String} Base64 encoded encrypted AES key
 */
export const encryptAesKeyWithRsa = (aesKey, publicKeyPem) => {
  const encrypted = crypto.publicEncrypt(
    {
      key: publicKeyPem,
      padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
      oaepHash: 'sha256',
    },
    aesKey
  );
  return encrypted.toString('base64');
};

/**
 * Decrypt AES Key with RSA Private Key
 * @param {String} encryptedAesKeyBase64
 * @param {String} privateKeyPem
 * @returns {Buffer} aesKey
 */
export const decryptAesKeyWithRsa = (encryptedAesKeyBase64, privateKeyPem) => {
  const encryptedAesKey = Buffer.from(encryptedAesKeyBase64, 'base64');
  return crypto.privateDecrypt(
    {
      key: privateKeyPem,
      padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
      oaepHash: 'sha256',
    },
    encryptedAesKey
  );
};


// --- Helper to securely store user's private key in DB (Option A) ---
// We use a server-side secret (or could derive from user password) to encrypt their private key.

const SERVER_SECRET_KEY = crypto.scryptSync(process.env.USER_KEY_ENCRYPTION_SECRET || 'fallback_secret', 'salt', 32);

export const encryptPrivateKey = (privateKeyPem) => {
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv('aes-256-cbc', SERVER_SECRET_KEY, iv);
  let encrypted = cipher.update(privateKeyPem, 'utf8', 'base64');
  encrypted += cipher.final('base64');
  return `${iv.toString('base64')}:${encrypted}`;
};

export const decryptPrivateKey = (encryptedString) => {
  const [ivBase64, encryptedData] = encryptedString.split(':');
  const iv = Buffer.from(ivBase64, 'base64');
  const decipher = crypto.createDecipheriv('aes-256-cbc', SERVER_SECRET_KEY, iv);
  let decrypted = decipher.update(encryptedData, 'base64', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
};
