const Order = require('../models/order');
const { generateNewAddressForOrder } = require('../services/walletService');

const createOrder = async (req, res) => {
  try {
    const { store, customerEmail, totalAmount, paymentMethod } = req.body;

    // Validação básica
    if (!store || !totalAmount || !paymentMethod) {
      return res.status(400).json({ message: 'Dados incompletos para criar o pedido.' });
    }

    const merchantAddress = await generateNewAddressForOrder(store);

    const newOrder = new Order({
      store,
      customerEmail: customerEmail || 'Não identificado',
      totalAmount,
      paymentMethod,
      merchantAddress, // endereço único gerado
    });

    const savedOrder = await newOrder.save();
    res.status(201).json(savedOrder);
  } catch (error) {
    console.error('Erro ao criar pedido:', error);
    res.status(500).json({ message: 'Erro ao criar pedido.' });
  }
};

module.exports = { createOrder };