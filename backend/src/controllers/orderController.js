const Order = require('../models/order');
const { generateNewAddressForOrder } = require('../services/walletService');
const { getBchToBrlRate } = require('../services/exchangeRate');
const { verifyPayment } = require('../services/bchService'); // Import verifyPayment
const logger = require('../utils/logger'); // Certifique-se de que o caminho está correto

const createOrder = async (req, res) => {
  try {
    logger.info(`[createOrder] Dados recebidos: ${JSON.stringify(req.body)}`);

    const { store, customerEmail, totalAmount, paymentMethod, items } = req.body; // Added items here
    const userId = req.user.id; // Get userId from authenticated user

    if (!store || !totalAmount || !paymentMethod || !userId) { // Added userId check
      logger.warn(`[createOrder] Dados incompletos para criar o pedido.`);
      return res.status(400).json({ message: 'Dados incompletos para criar o pedido.' });
    }

    let merchantAddress;
    let exchangeRate;

    if (paymentMethod === 'bch') {
      exchangeRate = await getBchToBrlRate();
      logger.info(`[createOrder] Cotação do BCH: ${exchangeRate}`);

      merchantAddress = await generateNewAddressForOrder(store, userId);
      logger.info(`[createOrder] Endereço BCH gerado: ${merchantAddress}`);
    }

    const newOrder = new Order({
      store,
      customerEmail: customerEmail || 'Não identificado',
      items: items || [], // Save items, default to empty array if not provided
      totalAmount,
      paymentMethod,
      paymentAddress: paymentMethod === 'bch' ? merchantAddress : undefined, // Ensure this matches the schema field name 'paymentAddress'
      exchangeRate: paymentMethod === 'bch' ? exchangeRate : undefined, // Ensure this matches the schema field name 'exchangeRate'
      user: userId, // Save the user ID
      status: 'pending', // Default status
    });

    const savedOrder = await newOrder.save();
    logger.info(`[createOrder] Pedido criado com sucesso: ${JSON.stringify(savedOrder)}`);
    res.status(201).json(savedOrder);
  } catch (error) {
    logger.error(`[createOrder] Erro ao criar pedido: ${error.message}`, error.stack);
    // Send a more generic message to the client for unexpected errors
    if (error.message.includes('Erro ao gerar endereço BCH') || error.message.includes('Dados da carteira')) {
        return res.status(500).json({ message: error.message }); // Keep specific messages for known wallet issues
    }
    res.status(500).json({ message: 'Ocorreu um erro interno ao processar seu pedido.' });
  }
};

const verifyOrderPayment = async (req, res) => {
  try {
    const { orderId } = req.params;
    const order = await Order.findById(orderId);

    if (!order) {
      return res.status(404).json({ message: 'Pedido não encontrado.' });
    }

    if (order.paymentMethod !== 'bch' || !order.merchantAddress || !order.exchangeRate) {
      logger.warn(`[verifyOrderPayment] Tentativa de verificar pagamento para pedido não-BCH ou sem dados de BCH. OrderId: ${orderId}`);
      return res.status(400).json({ message: 'Verificação de pagamento não aplicável para este tipo de pedido.' });
    }

    const isPaid = await verifyPayment(order.merchantAddress, order.totalAmount / order.exchangeRate); // verifyPayment from bchService

    if (isPaid) {
      order.status = 'paid';
      await order.save();
      return res.status(200).json({ message: 'Pagamento confirmado.', order });
    }

    res.status(200).json({ message: 'Pagamento ainda não recebido.', order });
  } catch (error) {
    logger.error(`[verifyOrderPayment] Erro ao verificar pagamento para OrderId ${req.params.orderId}: ${error.message}`, error.stack);
    res.status(500).json({ message: 'Erro interno ao verificar pagamento.' });
  }
};

module.exports = { createOrder, verifyOrderPayment };