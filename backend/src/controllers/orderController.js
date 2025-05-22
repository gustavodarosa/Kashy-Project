// z:\git lixo\Kashy-Project\backend\src\controllers\orderController.js
const Order = require('../models/Order'); // Ensure consistent casing with your model file
const { deriveInvoiceAddress } = require('../services/walletService'); // Use deriveInvoiceAddress
const { getBchToBrlRate } = require('../services/exchangeRate');
const { verifyPayment } = require('../services/bchService'); // Import verifyPayment
const User = require('../models/user');
const cryptoUtils = require('../utils/cryptoUtils');
const spvMonitorServiceInstance = require('../services/spvMonitorService');
const UserOrderIndex = require('../models/UserOrderIndex');
const logger = require('../utils/logger'); // Certifique-se de que o caminho está correto

const createOrder = async (req, res) => {
  try {
    logger.info(`[createOrder] Dados recebidos: ${JSON.stringify(req.body)}`);

    const { store, customerEmail, totalAmount, paymentMethod, items } = req.body; // Added items here
    const userId = req.user.id; // Get userId from authenticated user

    if (!store || !totalAmount || !paymentMethod || !userId || !items || !Array.isArray(items) || items.length === 0) { // Added userId and items check
      logger.warn(`[createOrder] Dados incompletos para criar o pedido. Store: ${store}, TotalAmount: ${totalAmount}, PaymentMethod: ${paymentMethod}, UserID: ${userId}, Items: ${JSON.stringify(items)}`);
      return res.status(400).json({ message: 'Dados incompletos para criar o pedido. Verifique loja, valor total, método de pagamento e itens.' });
    }

    let orderData = {
      store,
      customerEmail: customerEmail || 'Não identificado',
      items: items || [],
      totalAmount, // This is totalAmount in BRL
      paymentMethod,
      user: userId,
      status: 'pending',
      createdAt: new Date(), // Explicitly set if not relying on Mongoose timestamps for this
      // Initialize payment tracking fields
      amountPaidBRL: 0,
      amountPaidBCH: 0,
      overpaymentAmountBRL: 0,
    };

    if (paymentMethod === 'bch') {
      logger.info(`[createOrder] Processing BCH order for merchant ${userId}.`);
      const userIndexDoc = await UserOrderIndex.findOneAndUpdate(
        { user: userId }, // Match UserOrderIndex schema field 'user'
        { $inc: { lastOrderIndex: 1 } }, // Match UserOrderIndex schema field 'lastOrderIndex'
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );
      const invoiceIndex = userIndexDoc.lastOrderIndex; // Use 'lastOrderIndex'
      logger.debug(`[createOrder] Next invoice index for merchant ${userId}: ${invoiceIndex}`);

      const merchant = await User.findById(userId).select('+encryptedMnemonic +encryptedDerivationPath');
      if (!merchant || !merchant.encryptedMnemonic || !merchant.encryptedDerivationPath) {
        logger.error(`[createOrder] Wallet data (mnemonic/path) not found for merchant ${userId}`);
        return res.status(500).json({ message: 'Configuração da carteira do comerciante incompleta.' });
      }
      logger.debug(`[createOrder] Fetched wallet data for merchant ${userId}.`);

      const mainDerivationPath = cryptoUtils.decrypt(merchant.encryptedDerivationPath, process.env.ENCRYPTION_KEY);
      const pathSegments = mainDerivationPath.split('/');
      if (pathSegments.length < 2) {
        logger.error(`[createOrder] Invalid main derivation path structure for merchant ${userId}: ${mainDerivationPath}`);
        return res.status(500).json({ message: 'Configuração de caminho de derivação inválida para o comerciante.' });
      }
      const basePathForInvoiceDerivation = pathSegments.slice(0, -1).join('/');
      const encryptedBasePathForInvoice = cryptoUtils.encrypt(basePathForInvoiceDerivation, process.env.ENCRYPTION_KEY);
      logger.debug(`[createOrder] Main path: ${mainDerivationPath}, Base for invoice: ${basePathForInvoiceDerivation}`);

      const { address: derivedMerchantAddress, invoicePath: derivedInvoicePath } = await deriveInvoiceAddress(
        merchant.encryptedMnemonic,
        encryptedBasePathForInvoice,
        process.env.ENCRYPTION_KEY,
        invoiceIndex
      );
      logger.info(`[createOrder] Derived invoice address for merchant ${userId}: ${derivedMerchantAddress} (Path: ${derivedInvoicePath})`);

      const currentExchangeRate = await getBchToBrlRate();
      if (!currentExchangeRate || currentExchangeRate <= 0) {
        logger.error(`[createOrder] Invalid exchange rate received: ${currentExchangeRate}`);
        return res.status(500).json({ message: 'Não foi possível obter uma taxa de câmbio válida.' });
      }
      const calculatedAmountBCH = Number((totalAmount / currentExchangeRate).toFixed(8));
      logger.debug(`[createOrder] Total BRL: ${totalAmount}, Rate: ${currentExchangeRate}, Amount BCH: ${calculatedAmountBCH}`);

      // Add BCH specific fields to orderData
      // These field names must match your Order model schema
      orderData.merchantAddress = derivedMerchantAddress;
      orderData.invoicePath = derivedInvoicePath;
      orderData.amountBCH = calculatedAmountBCH; // Expected amount in BCH
      orderData.exchangeRateUsed = currentExchangeRate;
    }

    const newOrder = new Order(orderData);
    const savedOrder = await newOrder.save();
    logger.info(`[createOrder] Order ${savedOrder._id} created successfully for merchant ${userId}.`);

    if (paymentMethod === 'bch' && savedOrder.merchantAddress) {
      spvMonitorServiceInstance.addSubscription(userId.toString(), savedOrder.merchantAddress, savedOrder._id.toString());
      logger.info(`[createOrder] Address ${savedOrder.merchantAddress} (Order ${savedOrder._id}) added to SPV monitoring for merchant ${userId}.`);
    }

    res.status(201).json(savedOrder);
  } catch (error) {
    logger.error(`[createOrder] Erro ao criar pedido: ${error.message}`, { stack: error.stack }); // Log full stack
    // Send a more generic message to the client for unexpected errors
    if (error.message.includes('Erro ao gerar endereço BCH') || error.message.includes('Dados da carteira') || error.message.includes('Configuração da carteira')) {
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
      logger.warn(`[verifyOrderPayment] Pedido não encontrado: ${orderId}`);
      return res.status(404).json({ message: 'Pedido não encontrado.' });
    }

    // Use the field names from your Order model schema
    if (order.paymentMethod !== 'bch' || !order.merchantAddress || !order.exchangeRateUsed || order.amountBCH === undefined) {
      logger.warn(`[verifyOrderPayment] Tentativa de verificar pagamento para pedido não-BCH ou sem dados de BCH. OrderId: ${orderId}`);
      return res.status(400).json({ message: 'Verificação de pagamento não aplicável para este tipo de pedido.' });
    }

    // verifyPayment expects the amount in BCH
    // This is a manual verification, SPV monitor should handle automatic updates.
    // This endpoint might be for a user/merchant to manually trigger a check.
    const isPaid = await verifyPayment(order.merchantAddress, order.amountBCH); 

    if (isPaid) {
      // This manual verification might not have full TX details like SPV.
      // It's better if SPV handles the detailed status update.
      // Here, we can just confirm if the expected amount is seen.
      // The actual status update to 'paid' or 'confirmed_paid' should ideally be driven by SPV.
      // However, if this is a fallback or manual check, we can update status.
      if (order.status !== 'paid' && order.status !== 'confirmed_paid') {
        // order.status = 'payment_detected'; // Or 'paid' if you consider this sufficient
        // await order.save();
        // logger.info(`[verifyOrderPayment] Pagamento detectado (manual check) para OrderId ${orderId}. SPV should confirm further.`);
      }
      logger.info(`[verifyOrderPayment] Verificação manual: Pagamento encontrado para OrderId ${orderId}.`);
      return res.status(200).json({ message: 'Pagamento encontrado (verificação manual).', orderStatus: order.status, isPaid: true, order });
    }

    logger.info(`[verifyOrderPayment] Verificação manual: Pagamento ainda não encontrado para OrderId ${orderId}.`);
    res.status(200).json({ message: 'Pagamento ainda não encontrado (verificação manual).', orderStatus: order.status, isPaid: false, order });
  } catch (error) {
    logger.error(`[verifyOrderPayment] Erro ao verificar pagamento para OrderId ${req.params.orderId}: ${error.message}`, { stack: error.stack });
    res.status(500).json({ message: 'Erro interno ao verificar pagamento.' });
  }
};

const getOrderById = async (req, res) => {
  try {
    const { orderId } = req.params;
    const userId = req.user.id; // Assuming user is authenticated and ID is available

    const order = await Order.findOne({ _id: orderId, user: userId }); // Ensure user owns the order

    if (!order) {
      logger.warn(`[getOrderById] Pedido ${orderId} não encontrado para o usuário ${userId}.`);
      return res.status(404).json({ message: 'Pedido não encontrado.' });
    }

    logger.info(`[getOrderById] Pedido ${orderId} encontrado para o usuário ${userId}.`);
    res.status(200).json(order);
  } catch (error) {
    logger.error(`[getOrderById] Erro ao buscar pedido ${req.params.orderId}: ${error.message}`, { stack: error.stack });
    res.status(500).json({ message: 'Erro interno ao buscar pedido.' });
  }
};

const listOrders = async (req, res) => {
  try {
    const userId = req.user.id; // Assuming user is authenticated
    // Add pagination, filtering, sorting as needed
    const { page = 1, limit = 10, status, paymentMethod } = req.query;
    
    const query = { user: userId };
    if (status) query.status = status;
    if (paymentMethod) query.paymentMethod = paymentMethod;

    const options = {
      page: parseInt(page, 10),
      limit: parseInt(limit, 10),
      sort: { createdAt: -1 } // Sort by newest first
    };

    // If using mongoose-paginate-v2 or similar for pagination:
    // const result = await Order.paginate(query, options);
    // res.status(200).json(result);

    // Manual pagination example:
    const orders = await Order.find(query)
      .sort(options.sort)
      .skip((options.page - 1) * options.limit)
      .limit(options.limit);
    
    const totalOrders = await Order.countDocuments(query);

    logger.info(`[listOrders] Listando pedidos para o usuário ${userId}. Página: ${page}, Limite: ${limit}`);
    res.status(200).json({
      docs: orders,
      totalDocs: totalOrders,
      limit: options.limit,
      page: options.page,
      totalPages: Math.ceil(totalOrders / options.limit),
      // hasPrevPage, hasNextPage, prevPage, nextPage can be calculated
    });

  } catch (error) {
    logger.error(`[listOrders] Erro ao listar pedidos para o usuário ${req.user.id}: ${error.message}`, { stack: error.stack });
    res.status(500).json({ message: 'Erro interno ao listar pedidos.' });
  }
};

// Placeholder for updating an order (e.g., status by merchant)
const updateOrderStatus = async (req, res) => {
    try {
        const { orderId } = req.params;
        const { status } = req.body; // New status from request body
        const userId = req.user.id; // Merchant's ID

        if (!status) {
            logger.warn(`[updateOrderStatus] Status não fornecido para atualizar o pedido ${orderId}.`);
            return res.status(400).json({ message: 'Novo status é obrigatório.' });
        }

        // Find the order and ensure it belongs to the authenticated merchant
        const order = await Order.findOne({ _id: orderId, user: userId });

        if (!order) {
            logger.warn(`[updateOrderStatus] Pedido ${orderId} não encontrado ou não pertence ao usuário ${userId}.`);
            return res.status(404).json({ message: 'Pedido não encontrado ou não autorizado.' });
        }

        // Add validation for allowed status transitions if needed
        // For example, a merchant might manually mark as 'refunded' or 'cancelled'
        // if certain conditions are met.
        const allowedMerchantUpdates = ['cancelled', 'refunded']; // Example
        if (!allowedMerchantUpdates.includes(status)) {
             logger.warn(`[updateOrderStatus] Tentativa de atualização para status inválido '${status}' pelo comerciante para o pedido ${orderId}.`);
             return res.status(400).json({ message: `Atualização para status '${status}' não permitida.` });
        }
        
        // Logic for specific status updates, e.g., handling refunds
        if (status === 'refunded' && order.status !== 'paid' && order.status !== 'confirmed_paid' && order.status !== 'partially_paid') {
            logger.warn(`[updateOrderStatus] Tentativa de reembolsar pedido ${orderId} que não está pago ou parcialmente pago. Status atual: ${order.status}`);
            return res.status(400).json({ message: 'Só é possível reembolsar pedidos pagos ou parcialmente pagos.' });
        }
        
        // If refunding a partially paid order, the amount to refund is order.amountPaidBRL
        // If refunding a fully paid order, the amount is order.totalAmount (or order.amountPaidBRL if overpaid)
        // The actual refund transaction (BCH or other) would be handled separately by the merchant.
        // This controller action just updates the order's status in the DB.

        const oldStatus = order.status;
        order.status = status;
        // If refunding, you might want to clear paid amounts or log refund details
        if (status === 'refunded') {
            // order.amountPaidBRL = 0; // Or keep it for history and add a refundedAmount field
            // order.amountPaidBCH = 0;
            // order.transaction = null; // Or add refund transaction details
        }

        await order.save();
        logger.info(`[updateOrderStatus] Status do pedido ${orderId} atualizado de '${oldStatus}' para '${status}' pelo usuário ${userId}.`);

        // Notify client via WebSocket if implemented
        if (spvMonitorServiceInstance.io) {
            spvMonitorServiceInstance.io.to(userId.toString()).emit('orderUpdate', order.toObject());
        }

        res.status(200).json(order);
    } catch (error) {
        logger.error(`[updateOrderStatus] Erro ao atualizar status do pedido ${req.params.orderId}: ${error.message}`, { stack: error.stack });
        res.status(500).json({ message: 'Erro interno ao atualizar status do pedido.' });
    }
};


module.exports = {
  createOrder,
  verifyOrderPayment,
  getOrderById,
  listOrders,
  updateOrderStatus,
};
