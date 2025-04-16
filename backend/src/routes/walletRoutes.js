const express = require('express');
const walletController = require('../controllers/walletController'); // Certifique-se de que o arquivo existe
const { authMiddleware } = require('../middlewares/authMiddleware'); // Middleware de autenticação

const router = express.Router();

// Rota para obter dados da carteira
router.get('/', authMiddleware, walletController.getWalletData);

module.exports = router;