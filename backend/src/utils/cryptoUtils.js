const crypto = require('crypto');

const ALGORITHM = 'aes-256-cbc';
const IV_LENGTH = 16; // Tamanho do vetor de inicialização (16 bytes)

/**
 * Deriva uma chave de 32 bytes a partir de uma chave maior usando SHA-256.
 * @param {string} key - A chave original (pode ter qualquer comprimento).
 * @returns {Buffer} - Uma chave de 32 bytes.
 */
function deriveKey(key) {
  return crypto.createHash('sha256').update(key).digest();
}

/**
 * Criptografa um texto usando uma chave de criptografia.
 * @param {string} text - O texto a ser criptografado.
 * @param {string} key - A chave de criptografia (pode ter qualquer comprimento).
 * @returns {string} - O texto criptografado no formato "iv:ciphertext".
 */
function encrypt(text, key) {
  const derivedKey = deriveKey(key); // Deriva uma chave de 32 bytes
  const iv = crypto.randomBytes(IV_LENGTH); // Gera um vetor de inicialização aleatório
  const cipher = crypto.createCipheriv(ALGORITHM, derivedKey, iv);

  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');

  // Retorna o IV e o texto criptografado no formato "iv:ciphertext"
  return `${iv.toString('hex')}:${encrypted}`;
}

/**
 * Descriptografa um texto criptografado usando uma chave de criptografia.
 * @param {string} encryptedText - O texto criptografado no formato "iv:ciphertext".
 * @param {string} key - A chave de descriptografia (pode ter qualquer comprimento).
 * @returns {string} - O texto descriptografado.
 */
function decrypt(encryptedText, key) {
  // Validação básica do formato de entrada
  if (typeof encryptedText !== 'string' || !encryptedText.includes(':')) {
    console.error('Erro de descriptografia: Formato de entrada inválido. Esperado "iv:ciphertext". Recebido:', encryptedText);
    throw new Error('Formato de texto criptografado inválido.');
  }

  const parts = encryptedText.split(':');
  if (parts.length !== 2 || !parts[0] || !parts[1]) {
    console.error('Erro de descriptografia: Formato de entrada inválido após divisão. Partes:', parts);
    console.error(encryptedText);
    throw new Error('Formato de texto criptografado inválido após divisão.');
  }

  const [ivHex, encryptedData] = parts;

  // Valida o comprimento do IV (16 bytes = 32 caracteres hexadecimais)
  if (ivHex.length !== IV_LENGTH * 2) {
    console.error(`Erro de descriptografia: Comprimento do IV inválido. Esperado ${IV_LENGTH * 2}, Recebido ${ivHex.length}. IV Hex: ${ivHex}`);
    throw new Error('Comprimento do IV inválido.');
  }

  try {
    const derivedKey = deriveKey(key);
    const iv = Buffer.from(ivHex, 'hex');
    const decipher = crypto.createDecipheriv(ALGORITHM, derivedKey, iv);

    let decrypted = decipher.update(encryptedData, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  } catch (error) {
    console.error('Falha na descriptografia durante a operação criptográfica:', error.message);
    throw error;
  }
}

const testKey = process.env.ENCRYPTION_KEY;
const testMnemonic = "legal winner thank year wave sausage worth useful legal winner thank yellow";
const testDerivationPath = "m/44'/145'/0'/0/0";

try {
  const encryptedMnemonic = encrypt(testMnemonic, testKey);
  const decryptedMnemonic = decrypt(encryptedMnemonic, testKey);

  console.log('Mnemônico original:', testMnemonic);
  console.log('Mnemônico criptografado:', encryptedMnemonic);
  console.log('Mnemônico descriptografado:', decryptedMnemonic);

  const encryptedPath = encrypt(testDerivationPath, testKey);
  const decryptedPath = decrypt(encryptedPath, testKey);

  console.log('Caminho de derivação original:', testDerivationPath);
  console.log('Caminho de derivação criptografado:', encryptedPath);
  console.log('Caminho de derivação descriptografado:', decryptedPath);
} catch (error) {
  console.error('Erro no teste de criptografia/descriptografia:', error);
}

module.exports = { encrypt, decrypt };