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

// Endpoint para buscar um pedido por ID
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const order = await Order.findById(id).populate('items.product');
    if (!order) {
      return res.status(404).json({ message: 'Pedido não encontrado.' });
    }
    res.status(200).json(order);
  } catch (error) {
    console.error('Erro ao buscar pedido:', error);
    res.status(500).json({ message: 'Erro ao buscar pedido.' });
  }
});

// Endpoint para criar um novo pedido
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

// Endpoint para atualizar um pedido
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { store, customerEmail, totalAmount, paymentMethod, status } = req.body;

    const updatedOrder = await Order.findByIdAndUpdate(
      id,
      { store, customerEmail, totalAmount, paymentMethod, status },
      { new: true, runValidators: true }
    );

    if (!updatedOrder) {
      return res.status(404).json({ message: 'Pedido não encontrado.' });
    }

    res.status(200).json(updatedOrder);
  } catch (error) {
    console.error('Erro ao atualizar pedido:', error);
    res.status(500).json({ message: 'Erro ao atualizar pedido.' });
  }
});

// Endpoint para deletar um pedido
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const deletedOrder = await Order.findByIdAndDelete(id);

    if (!deletedOrder) {
      return res.status(404).json({ message: 'Pedido não encontrado.' });
    }

    res.status(200).json({ message: 'Pedido deletado com sucesso.' });
  } catch (error) {
    console.error('Erro ao deletar pedido:', error);
    res.status(500).json({ message: 'Erro ao deletar pedido.' });
  }
});

module.exports = router;