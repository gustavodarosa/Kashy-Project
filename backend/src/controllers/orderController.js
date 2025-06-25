const Order = require('../models/Order'); // Ensure consistent casing with your model file
const { deriveInvoiceAddress } = require('../services/walletService'); // Use deriveInvoiceAddress
const { getBchToBrlRate } = require('../services/exchangeRate');
const { verifyPayment } = require('../services/bchService'); // Import verifyPayment
const User = require('../models/user');
const cryptoUtils = require('../utils/cryptoUtils');
const spvMonitorServiceInstance = require('../services/spvMonitorService');
const UserOrderIndex = require('../models/UserOrderIndex');
const logger = require('../utils/logger'); // Certifique-se de que o caminho está correto
const Product = require('../models/product'); // Certifique-se de importar o model Product

const createOrder = async (req, res) => {
  try {
    logger.info(`[createOrder] Dados recebidos: ${JSON.stringify(req.body)}`);

    const { store, customerEmail, totalAmount, paymentMethod, items } = req.body; // Added items here
    const userId = req.user.id; // Get userId from authenticated user

    if (!store || !totalAmount || !paymentMethod || !userId) { // Added userId check
      logger.warn(`[createOrder] Dados incompletos para criar o pedido.`);
      return res.status(400).json({ message: 'Dados incompletos para criar o pedido.' });
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
      orderData.amountBCH = calculatedAmountBCH;
      orderData.exchangeRateUsed = currentExchangeRate;
    }

    const newOrder = new Order(orderData);
    const savedOrder = await newOrder.save();

    // Atualiza o estoque dos produtos
    for (const item of savedOrder.items) {
      await Product.findByIdAndUpdate(
        item.product,
        { $inc: { quantity: -item.quantity } }, // subtrai a quantidade comprada
        { new: true }
      );
    }

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
      return res.status(404).json({ message: 'Pedido não encontrado.' });
    }

    // Use the field names from your Order model schema
    if (order.paymentMethod !== 'bch' || !order.merchantAddress || !order.exchangeRateUsed || !order.amountBCH) {
      logger.warn(`[verifyOrderPayment] Tentativa de verificar pagamento para pedido não-BCH ou sem dados de BCH. OrderId: ${orderId}`);
      return res.status(400).json({ message: 'Verificação de pagamento não aplicável para este tipo de pedido.' });
    }

    // verifyPayment expects the amount in BCH
    const isPaid = await verifyPayment(order.merchantAddress, order.amountBCH); 

    if (isPaid) {
      order.status = 'paid'; // <-- Aqui também, mantenha apenas 'paid'
      // ...outros campos...
      await order.save();
      logger.info(`[verifyOrderPayment] Pagamento confirmado para OrderId ${orderId}.`);
      return res.status(200).json({ message: 'Pagamento confirmado.', order });
    }
    // ...existing code...

    logger.info(`[verifyOrderPayment] Pagamento ainda não recebido para OrderId ${orderId}.`);
    res.status(200).json({ message: 'Pagamento ainda não recebido.', order });
  } catch (error) {
    logger.error(`[verifyOrderPayment] Erro ao verificar pagamento para OrderId ${req.params.orderId}: ${error.message}`, { stack: error.stack });
    res.status(500).json({ message: 'Erro interno ao verificar pagamento.' });
  }
};

module.exports = { createOrder, verifyOrderPayment };