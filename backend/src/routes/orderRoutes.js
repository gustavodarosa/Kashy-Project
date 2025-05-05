const express = require('express');
const router = express.Router();
const Order = require('../models/order');

// Endpoint para buscar todos os pedidos
router.get('/', async (req, res) => {
  try {
    const orders = await Order.find(); // Busca todos os pedidos no MongoDB
    res.status(200).json(orders);
  } catch (error) {
    console.error('Erro ao buscar pedidos:', error);
    res.status(500).json({ message: 'Erro ao buscar pedidos.' });
  }
});

module.exports = router;