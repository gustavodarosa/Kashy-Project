const crypto = require('crypto');

const deriveKey = (password, salt) => {
  return crypto.pbkdf2Sync(password, salt, 100000, 32, 'sha256');
};

const encrypt = (data, password) => {
  const salt = crypto.randomBytes(16).toString('hex');
  const key = deriveKey(password, salt);
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
  let encrypted = cipher.update(data, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return `${salt}:${iv.toString('hex')}:${encrypted}`;
};

const decrypt = (encryptedData, password) => {
  const [salt, ivHex, encryptedHex] = encryptedData.split(':');
  const key = deriveKey(password, salt);
  const iv = Buffer.from(ivHex, 'hex');
  const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
  let decrypted = decipher.update(encryptedHex, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
};

module.exports = { encrypt, decrypt }