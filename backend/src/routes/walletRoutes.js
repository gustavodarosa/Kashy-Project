const express = require('express');
const walletController = require('../controllers/walletController');
const { authMiddleware } = require('../middlewares/authMiddleware'); // Middleware de autenticação

const router = express.Router();

// Rota para obter dados da carteira
router.get('/', authMiddleware, walletController.getWalletData);

// Rota para enviar BCH
router.post('/send', authMiddleware, walletController.sendBCH);

module.exports = router;