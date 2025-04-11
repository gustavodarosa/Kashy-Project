const crypto = require('crypto');

/**
 * Gera o cabeçalho de autenticação HMAC-SHA256 para a API da NovaDAX.
 * @param {string} method - Método HTTP (GET, POST, etc.).
 * @param {string} path - Caminho da API.
 * @param {object} body - Corpo da requisição (se aplicável).
 * @returns {object} - Cabeçalhos de autenticação.
 */
function generateAuthHeaders(method, path, body = {}) {
  const apiKey = process.env.NOVADAX_API_KEY;
  const apiSecret = process.env.NOVADAX_API_SECRET;

  const timestamp = Date.now();
  const bodyString = JSON.stringify(body);
  const preHash = `${timestamp}${method}${path}${bodyString}`;
  const signature = crypto
    .createHmac('sha256', apiSecret)
    .update(preHash)
    .digest('hex');

  return {
    'X-Nova-Access-Key': apiKey,
    'X-Nova-Timestamp': timestamp,
    'X-Nova-Signature': signature,
    'Content-Type': 'application/json',
  };
}

module.exports = { generateAuthHeaders };