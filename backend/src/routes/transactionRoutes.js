const express = require('express');
const router = express.Router();
const { getTransactions } = require('../controllers/transactionController');
const { protect } = require('../middlewares/authMiddleware'); // Importe seu middleware de proteção

// @route   GET /api/transactions
// @desc    Busca as transações do usuário logado com filtros e paginação
// @access  Private
router.get('/', protect, getTransactions);

module.exports = router;