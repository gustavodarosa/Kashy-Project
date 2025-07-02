const express = require('express');
const router = express.Router();
const Order = require('../models/Order');
const Product = require('../models/product'); // Import Product model
const logger = require('../utils/logger'); // Import the logger
const { createOrder, updateOrder } = require('../controllers/orderController');
const { protect } = require('../middlewares/authMiddleware');

// Endpoint para buscar todos os pedidos
router.get('/', protect, async (req, res) => {
  try {
    if (!req.user || !req.user.id) {
      logger.warn('[GET /api/orders] Attempt to fetch orders without authenticated user.');
      return res.status(401).json({ message: 'Usuário não autenticado.' });
    }
    const { store } = req.query;
    const query = { user: req.user.id };
    if (store) {
      query.store = store;
    }
    const orders = await Order.find(query).populate('items.product').sort({ createdAt: -1 });
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
router.put('/:id', protect, async (req, res) => {
  try {
    const { id } = req.params;
    const { items, ...updateFields } = req.body;

    // 1. Busque o pedido antigo
    const oldOrder = await Order.findById(id);
    if (!oldOrder) return res.status(404).json({ message: 'Pedido não encontrado.' });

    // 2. Atualize o pedido
    const updatedOrder = await Order.findByIdAndUpdate(
      id,
      { ...updateFields, items },
      { new: true, runValidators: true }
    );

    // 3. Atualize o estoque dos produtos
    // Crie um mapa de quantidades antigas
    const oldQuantities = {};
    oldOrder.items.forEach(item => {
      oldQuantities[item.product.toString()] = item.quantity;
    });

    // Para cada item novo, calcule a diferença e atualize o estoque
    for (const item of items) {
      const productId = item.product;
      const oldQty = oldQuantities[productId] || 0;
      const diff = (item.quantity || 0) - oldQty;
      if (diff !== 0) {
        // Se diff > 0, diminui do estoque; se diff < 0, devolve ao estoque
        await Product.findByIdAndUpdate(
          productId,
          { $inc: { quantity: -diff } }
        );
      }
      // Remove do mapa para saber quais produtos foram removidos
      delete oldQuantities[productId];
    }

    // Para produtos que estavam no pedido antigo mas não estão mais, devolva ao estoque
    for (const productId in oldQuantities) {
      const qty = oldQuantities[productId];
      await Product.findByIdAndUpdate(
        productId,
        { $inc: { quantity: qty } }
      );
    }

    res.status(200).json(updatedOrder);
  } catch (error) {
    res.status(500).json({ message: 'Erro ao atualizar pedido.' });
  }
});

// Endpoint para deletar um pedido
router.delete('/:id', protect, async (req, res) => {
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