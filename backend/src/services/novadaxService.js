const axios = require('axios');
const { generateAuthHeaders } = require('../config/auth');

const BASE_URL = 'https://api.novadax.com/v1';

/**
 * Obtém o saldo do usuário (criptos + reais).
 */
async function getWalletBalance() {
  const path = '/wallet/coins';
  const headers = generateAuthHeaders('GET', path);

  const response = await axios.get(`${BASE_URL}${path}`, { headers });
  return response.data;
}

/**
 * Realiza um saque via PIX para conta PF.
 */
async function withdrawBRLViaPix({ amount, pixKey }) {
  const path = '/wallet/withdraw';
  const body = {
    currency: 'BRL',
    amount: parseFloat(amount),
    method: 'PIX',
    target: pixKey,
  };

  const headers = generateAuthHeaders('POST', path, body);
  const response = await axios.post(`${BASE_URL}${path}`, body, { headers });

  return response.data;
}

module.exports = { getBchBrlPrice, getWalletBalance, withdrawBRLViaPix };