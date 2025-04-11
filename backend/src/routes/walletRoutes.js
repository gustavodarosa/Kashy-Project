const express = require('express');
const { getSaldo, postWithdraw } = require('../controllers/walletController');

const router = express.Router();

// Rota para obter o saldo do usuário
router.get('/saldo', getSaldo);

// Rota para realizar saque via PIX
router.post('/withdraw', postWithdraw);

module.exports = router;