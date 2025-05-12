// z:\Kashy-Project\backend\src\utils\cryptoUtils.js
const crypto = require('crypto');
const logger = require('./logger'); // Assuming logger exists

// --- Use AES-256-GCM ---
const ALGORITHM = 'aes-256-gcm';
// --- Recommended IV length for GCM is 12 bytes ---
const IV_LENGTH = 12;
// --- Authentication Tag length (GCM default is 16 bytes) ---
const AUTH_TAG_LENGTH = 16;

/**
 * Deriva uma chave de 32 bytes a partir de uma chave maior usando SHA-256.
 * @param {string} key - A chave original (pode ter qualquer comprimento).
 * @returns {Buffer} - Uma chave de 32 bytes.
 */
function deriveKey(key) {
  // Using SHA-256 ensures a 32-byte key, suitable for aes-256
  return crypto.createHash('sha256').update(String(key)).digest();
}

/**
 * Criptografa um texto usando AES-256-GCM.
 * @param {string} text - O texto a ser criptografado.
 * @param {string} key - A chave de criptografia (será derivada para 32 bytes).
 * @returns {string} - O texto criptografado no formato "iv:authTag:ciphertext".
 */
function encrypt(text, key) {
  try {
    const derivedKey = deriveKey(key);
    // --- Generate a 12-byte IV ---
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv(ALGORITHM, derivedKey, iv);

    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    // --- Get the authentication tag ---
    const authTag = cipher.getAuthTag();

    // --- Return iv, authTag, and ciphertext ---
    return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
  } catch (error) {
    logger.error(`Encryption failed: ${error.message}`);
    throw new Error('Encryption process failed.'); // Throw a generic error
  }
}

/**
 * Descriptografa um texto criptografado com AES-256-GCM.
 * @param {string} encryptedText - O texto criptografado no formato "iv:authTag:ciphertext".
 * @param {string} key - A chave de descriptografia (será derivada para 32 bytes).
 * @returns {string} - O texto descriptografado.
 * @throws {Error} If decryption fails (e.g., invalid format, bad key, integrity check fail).
 */
function decrypt(encryptedText, key) {
  // Validate the input format "iv:authTag:ciphertext"
  if (typeof encryptedText !== 'string' || encryptedText.split(':').length !== 3) {
    logger.error(`Decryption Error: Invalid input format. Expected "iv:authTag:ciphertext". Received: ${encryptedText}`);
    throw new Error('Invalid encrypted text format.');
  }

  const [ivHex, authTagHex, encryptedData] = encryptedText.split(':');

  // Validate lengths
  if (ivHex.length !== IV_LENGTH * 2) {
    logger.error(`Decryption Error: Invalid IV length. Expected ${IV_LENGTH * 2}, Received ${ivHex.length}.`);
    throw new Error('Invalid IV length in encrypted text.');
  }
  if (authTagHex.length !== AUTH_TAG_LENGTH * 2) {
     logger.error(`Decryption Error: Invalid Auth Tag length. Expected ${AUTH_TAG_LENGTH * 2}, Received ${authTagHex.length}.`);
     throw new Error('Invalid authentication tag length in encrypted text.');
  }
  if (!encryptedData) {
      logger.error(`Decryption Error: Encrypted data part is missing.`);
      throw new Error('Missing encrypted data part in encrypted text.');
  }


  try {
    const derivedKey = deriveKey(key);
    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');

    const decipher = crypto.createDecipheriv(ALGORITHM, derivedKey, iv);

    // --- Set the authentication tag BEFORE decryption ---
    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(encryptedData, 'hex', 'utf8');
    // --- final() will throw an error if authentication fails ---
    decrypted += decipher.final('utf8');

    return decrypted;
  } catch (error) {
    // Log the specific crypto error, but throw a more generic one
    // This prevents leaking details about *why* it failed (e.g., bad key vs tampered data)
    logger.error(`Decryption failed during cryptographic operation: ${error.message}`);
    // Check for common GCM auth error
    if (error.message.toLowerCase().includes('unsupported state') || error.message.toLowerCase().includes('authentication failed')) {
         throw new Error('Decryption failed: Data integrity check failed or invalid key.');
    }
    throw new Error('Decryption process failed.');
  }
}

module.exports = { encrypt, decrypt };
