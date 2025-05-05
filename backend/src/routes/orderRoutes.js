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
router.post('/', async (req, res) => {
  try {
    const { store, customerEmail, totalAmount, paymentMethod } = req.body;

    if (!store || !totalAmount || !paymentMethod) {
      return res.status(400).json({ message: 'Dados incompletos para criar o pedido.' });
    }

    const newOrder = new Order({
      store,
      customerEmail: customerEmail || 'Não identificado',
      totalAmount,
      paymentMethod,
    });

    const savedOrder = await newOrder.save();
    res.status(201).json(savedOrder);
  } catch (error) {
    console.error('Erro ao criar pedido:', error);
    res.status(500).json({ message: 'Erro ao criar pedido.' });
  }
});
module.exports = router;