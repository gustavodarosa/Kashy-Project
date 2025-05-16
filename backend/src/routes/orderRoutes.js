const express = require('express');
const router = express.Router();
const Order = require('../models/order');
const logger = require('../utils/logger'); // Import the logger
const { createOrder } = require('../controllers/orderController');
const { protect } = require('../middlewares/authMiddleware');

// Endpoint para buscar todos os pedidos
router.get('/', protect, async (req, res) => {

  try {
    // Ensure user is authenticated to fetch their orders
    if (!req.user || !req.user.id) {
       logger.warn('[GET /api/orders] Attempt to fetch orders without authenticated user.');
       return res.status(401).json({ message: 'Usuário não autenticado.' });
    }
    // Busca apenas os pedidos atrelados ao usuário logado
    const orders = await Order.find({ user: req.user.id }).populate('items.product').sort({ createdAt: -1 }); // Sort by creation date descending
    res.status(200).json(orders);
  } catch (error) {
    console.error('Erro ao buscar pedidos:', error);
    res.status(500).json({ message: 'Erro ao buscar pedidos.' });
  }
});

// Endpoint para buscar um pedido por ID
router.get('/:id', protect, async (req, res) => {
  try {
    logger.info(`[GET /api/orders/:id] Recebida requisição para buscar pedido ID: ${req.params.id}`);
    if (!req.user || !req.user.id) {
       logger.warn(`[GET /api/orders/:id] Attempt to fetch order ${req.params.id} without authenticated user.`);
       return res.status(401).json({ message: 'Usuário não autenticado.' });
    }
    const { id } = req.params;
    const order = await Order.findById(id).populate('items.product');
    logger.debug(`[GET /api/orders/:id] Pedido encontrado no DB: ${order ? JSON.stringify(order.toObject()) : 'null'}`); // Log the fetched object
    // Check if the fetched order belongs to the authenticated user
    if (order && order.user.toString() !== req.user.id.toString()) { return res.status(403).json({ message: 'Acesso negado. Este pedido não pertence ao usuário autenticado.' }); }
    if (!order) {
      return res.status(404).json({ message: `Pedido com ID ${id} não encontrado.` });
    }
    res.status(200).json(order);
  } catch (error) {
    console.error('Erro ao buscar pedido:', error);
    res.status(500).json({ message: 'Erro ao buscar pedido.' });
  }
});

// Endpoint para criar um novo pedido
router.post(
  '/',
  protect, // Apply authentication middleware here
  (req, res, next) => {
    logger.info(`[POST /api/orders] Requisição recebida. User ID: ${req.user?.id}. Body: ${JSON.stringify(req.body)}`);
    next();
  },
  createOrder
);

// Endpoint para atualizar um pedido
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    if (!req.user || !req.user.id) {
       logger.warn(`[PUT /api/orders/:id] Attempt to update order ${id} without authenticated user.`);
       return res.status(401).json({ message: 'Usuário não autenticado.' });
    }
    // Find the order first to check ownership
    const existingOrder = await Order.findById(id);
    const { store, customerEmail, totalAmount, paymentMethod, status } = req.body;

    const updatedOrder = await Order.findByIdAndUpdate(
      id,
      { store, customerEmail, totalAmount, paymentMethod, status },
      { new: true, runValidators: true }
    );

    if (!updatedOrder) {
      // If existingOrder was found but update failed for other reasons, this might still be reached
      if (existingOrder && existingOrder.user.toString() !== req.user.id.toString()) { return res.status(403).json({ message: 'Acesso negado. Este pedido não pertence ao usuário autenticado.' }); }
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

    if (!req.user || !req.user.id) {
       logger.warn(`[DELETE /api/orders/:id] Attempt to delete order ${id} without authenticated user.`);
       return res.status(401).json({ message: 'Usuário não autenticado.' });
    }
    // Find the order first to check ownership before deleting
    const deletedOrder = await Order.findByIdAndDelete(id);

    if (!deletedOrder) {
      return res.status(404).json({ message: 'Pedido não encontrado.' });
    }

    res.status(200).json({ message: 'Pedido deletado com sucesso.' });
    // Note: A more robust check would be to find the order, check ownership, THEN delete.
    // const orderToDelete = await Order.findOne({ _id: id, user: req.user.id }); if (!orderToDelete) { return 404/403 } await orderToDelete.remove();
  } catch (error) {
    console.error('Erro ao deletar pedido:', error);
    res.status(500).json({ message: 'Erro ao deletar pedido.' });
  }
});

module.exports = router;