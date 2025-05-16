const express = require('express');
const router = express.Router();
const Transaction = require('../models/transaction');

// Retorna todas as transações de todos os usuários
router.get('/', async (req, res) => {
  try {
    const transactions = await Transaction.find(); // Remova o populate para testar
    res.status(200).json(transactions);
  } catch (error) {
    res.status(500).json({ message: 'Erro ao buscar transações', error: error.message });
  }
});

module.exports = router;