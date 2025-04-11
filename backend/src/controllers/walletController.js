const { getWalletBalance, withdrawBRLViaPix } = require('../services/novadaxService');

/**
 * Controlador para obter o saldo do usuário.
 */
async function getSaldo(req, res) {
  try {
    const saldo = await getWalletBalance();
    res.json(saldo);
  } catch (error) {
    console.error('Erro ao obter saldo:', error.message);
    res.status(500).json({ error: 'Erro ao obter saldo' });
  }
}

/**
 * Controlador para realizar saque via PIX.
 */
async function postWithdraw(req, res) {
  try {
    const { amount, pixKey } = req.body;
    if (!amount || !pixKey) {
      return res.status(400).json({ error: 'amount e pixKey são obrigatórios' });
    }

    const result = await withdrawBRLViaPix({ amount, pixKey });
    res.json(result);
  } catch (error) {
    console.error('Erro ao sacar via PIX:', error.response?.data || error.message);
    res.status(500).json({ error: 'Erro ao sacar via PIX' });
  }
}

module.exports = { getSaldo, postWithdraw };