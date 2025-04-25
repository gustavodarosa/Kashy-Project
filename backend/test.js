const crypto = require('crypto');

const ALGORITHM = 'aes-256-cbc';
const IV_LENGTH = 16; // 16 bytes for AES

function deriveKey(key) {
  return crypto.createHash('sha256').update(key).digest();
}

function decrypt(encryptedText, key) {
  const parts = encryptedText.split(':');
  if (parts.length !== 2) {
    throw new Error('Formato de texto criptografado inválido após divisão.');
  }

  const iv = Buffer.from(parts[0], 'hex');
  const encryptedData = Buffer.from(parts[1], 'hex');
  const derivedKey = deriveKey(key);

  const decipher = crypto.createDecipheriv(ALGORITHM, derivedKey, iv);
  let decrypted = decipher.update(encryptedData, 'hex', 'utf8');
  decrypted += decipher.final('utf8');

  return decrypted;
}

// Dados fornecidos
const encryptedMnemonic = '226d8df1d3f78cd4df1cf06212e3e9b6:fa63c6f98522b7831ad368c225b7525e:37bb1d68b034b680274c191bf802545c5f80ae40913304155987a0f7f6b1c9d274fa3fc112b48ff0c773b49f460797c936c3cce2214dc139ea7f28d9dd4018c50e5027d5dd933bbffa60ce52f6546e89';
const encryptionKey = 'd9491d5004e85cc67e5a650ec0b95cceb78ee5547e51d9fe78beaa905aeb82c';

try {
  const decryptedMnemonic = decrypt(encryptedMnemonic, encryptionKey);
  console.log('Mnemonic descriptografado:', decryptedMnemonic);
} catch (error) {
  console.error('Erro ao descriptografar o mnemonic:', error.message);
}