import { Router } from 'express';
import Order from '../models/Order';
import { deriveInvoiceAddress } from '../services/walletService';
import { getBchToBrlRate } from '../services/exchangeRate';
import User from '../models/user'; // Import User model
import cryptoUtils from '../utils/cryptoUtils'; // Import cryptoUtils
import spvMonitorServiceInstance from '../services/spvMonitorService'; // Import SPV service instance
import UserOrderIndex from '../models/UserOrderIndex';
import logger from '../utils/logger'; // Assuming you have a logger

const router = Router();

// Assuming you have authentication middleware (e.g., 'protect') that populates req.user
// router.post('/orders', protect, async (req, res) => {
router.post('/orders', async (req, res) => {
  const { 
    store, 
    customerEmail, 
    items, 
    totalAmount, 
    paymentMethod,
    // user: merchantIdFromBody // If passed in body, ensure it's validated or from trusted source.
  } = req.body;

  // Get merchantId from authenticated user (adjust if it comes from req.body and you have validation)
  // This assumes 'protect' middleware (if used) populates req.user.id
  const merchantId = req.user?.id; 

  if (!merchantId) {
    logger.error('[OrderController] Merchant ID not found. User might not be authenticated.');
    return res.status(401).json({ message: 'Usuário comerciante não autenticado ou não identificado.' });
  }

  logger.info(`[OrderController] Creating order for merchant: ${merchantId}, Payment Method: ${paymentMethod}`);

  try {
    // Fluxo para pedido com pagamento em BCH
    if (paymentMethod === 'bch') {
      logger.info(`[OrderController] Processing BCH order for merchant ${merchantId}.`);
      // 1. Obtenha o próximo índice sequencial para o usuário
      const userIndexDoc = await UserOrderIndex.findOneAndUpdate(
        { userId: merchantId },
        { $inc: { invoiceIndex: 1 } },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );
      const invoiceIndex = userIndexDoc.invoiceIndex;
      logger.debug(`[OrderController] Next invoice index for merchant ${merchantId}: ${invoiceIndex}`);

      // Fetch merchant's encrypted wallet data
      const merchant = await User.findById(merchantId).select('+encryptedMnemonic +encryptedDerivationPath');
      if (!merchant || !merchant.encryptedMnemonic || !merchant.encryptedDerivationPath) {
        logger.error(`[OrderController] Wallet data (mnemonic/path) not found for merchant ${merchantId}`);
        return res.status(500).json({ message: 'Configuração da carteira do comerciante incompleta.' });
      }
      logger.debug(`[OrderController] Fetched wallet data for merchant ${merchantId}.`);

      // Decrypt the main derivation path to get the base for invoice derivation
      const mainDerivationPath = cryptoUtils.decrypt(merchant.encryptedDerivationPath, process.env.ENCRYPTION_KEY);
      // Extract the parent path (e.g., "m/44'/145'/0'/0" from "m/44'/145'/0'/0/0")
      const pathSegments = mainDerivationPath.split('/');
      if (pathSegments.length < 2) { // Basic check for valid path structure
        logger.error(`[OrderController] Invalid main derivation path structure for merchant ${merchantId}: ${mainDerivationPath}`);
        return res.status(500).json({ message: 'Configuração de caminho de derivação inválida para o comerciante.' });
      }
      const basePathForInvoiceDerivation = pathSegments.slice(0, -1).join('/');
      const encryptedBasePathForInvoice = cryptoUtils.encrypt(basePathForInvoiceDerivation, process.env.ENCRYPTION_KEY);
      logger.debug(`[OrderController] Main path: ${mainDerivationPath}, Base for invoice: ${basePathForInvoiceDerivation}`);

      // 2. Derive endereço BCH para a fatura
      const { address: merchantBchAddress, invoicePath } = await deriveInvoiceAddress(
        merchant.encryptedMnemonic,    // Use fetched merchant's encrypted mnemonic
        encryptedBasePathForInvoice, // Pass the derived and re-encrypted base path
        process.env.ENCRYPTION_KEY,
        invoiceIndex
      );
      logger.info(`[OrderController] Derived invoice address for merchant ${merchantId}: ${merchantBchAddress} (Path: ${invoicePath})`);

      // 3. Calcule valor em BCH
      const exchangeRate = await getBchToBrlRate();
      if (!exchangeRate || exchangeRate <= 0) {
        logger.error(`[OrderController] Invalid exchange rate received: ${exchangeRate}`);
        return res.status(500).json({ message: 'Não foi possível obter uma taxa de câmbio válida.' });
      }
      const amountBch = Number((totalAmount / exchangeRate).toFixed(8));
      logger.debug(`[OrderController] Total BRL: ${totalAmount}, Rate: ${exchangeRate}, Amount BCH: ${amountBch}`);

      // 4. Crie e salve o pedido
      const order = await Order.create({
        store,
        customerEmail,
        items,
        totalAmount, // This is totalAmount in BRL
        paymentMethod,
        user: merchantId, // Link to the merchant User
        merchantAddress: merchantBchAddress, // The derived BCH address for this invoice
        invoicePath, // The derivation path for this invoice address
        amountBCH: amountBch, // Amount in BCH
        exchangeRateUsed: exchangeRate,
        status: 'pending',
        createdAt: new Date(),
      });
      logger.info(`[OrderController] BCH Order ${order._id} created successfully for merchant ${merchantId}.`);

      // 5. Após salvar o pedido, adicione o endereço da fatura ao monitoramento SPV
      if (order && order.merchantAddress) {
        spvMonitorServiceInstance.addSubscription(merchantId.toString(), order.merchantAddress, order._id.toString());
        logger.info(`[OrderController] Address ${order.merchantAddress} (Order ${order._id}) added to SPV monitoring for merchant ${merchantId}.`);
      }

      return res.status(201).json(order);
    }

    // Fluxo para outros métodos de pagamento (PIX, Cartão, etc.)
    logger.info(`[OrderController] Processing non-BCH order for merchant ${merchantId}, Method: ${paymentMethod}.`);
    // For simplicity, let's assume non-BCH orders are just saved directly
    // You would have more specific logic here for other payment types
    const order = await Order.create({ 
        store, 
        customerEmail, 
        items, 
        totalAmount, 
        paymentMethod, 
        user: merchantId, 
        status: 'pending', // Or appropriate status for other payment methods
        createdAt: new Date() 
    });
    logger.info(`[OrderController] Non-BCH Order ${order._id} created successfully for merchant ${merchantId}.`);
    return res.status(201).json(order);

  } catch (error) {
    logger.error(`[OrderController] Error creating order for merchant ${merchantId}: ${error.message}`, { stack: error.stack });
    return res.status(500).json({ message: 'Erro ao criar pedido. Por favor, tente novamente.' });
  }
});

// GET /api/orders - Fetches all orders for the authenticated user
router.get('/orders', async (req, res) => {
  const merchantId = req.user?.id;
  if (!merchantId) {
    logger.warn('[GET /api/orders] Attempt to fetch orders without authenticated user.');
    return res.status(401).json({ message: 'Usuário não autenticado.' });
  }
  try {
    logger.info(`[GET /api/orders] Fetching orders for merchant ${merchantId}`);
    const orders = await Order.find({ user: merchantId })
                              .populate('items.product') // If you have a Product model linked
                              .sort({ createdAt: -1 });
    logger.debug(`[GET /api/orders] Found ${orders.length} orders for merchant ${merchantId}.`);
    res.status(200).json(orders);
  } catch (error) {
    logger.error(`[GET /api/orders] Error fetching orders for merchant ${merchantId}: ${error.message}`, { stack: error.stack });
    res.status(500).json({ message: 'Erro ao buscar pedidos.' });
  }
});

// GET /api/orders/:id - Fetches a specific order by ID for the authenticated user
router.get('/orders/:id', async (req, res) => {
  const merchantId = req.user?.id;
  const { id: orderId } = req.params;

  if (!merchantId) {
    logger.warn(`[GET /api/orders/:id] Attempt to fetch order ${orderId} without authenticated user.`);
    return res.status(401).json({ message: 'Usuário não autenticado.' });
  }
  try {
    logger.info(`[GET /api/orders/:id] Fetching order ${orderId} for merchant ${merchantId}`);
    const order = await Order.findById(orderId).populate('items.product');
    
    if (!order) {
      logger.warn(`[GET /api/orders/:id] Order ${orderId} not found for merchant ${merchantId}.`);
      return res.status(404).json({ message: `Pedido com ID ${orderId} não encontrado.` });
    }

    // Check if the fetched order belongs to the authenticated user
    if (order.user.toString() !== merchantId.toString()) {
      logger.warn(`[GET /api/orders/:id] Access denied for merchant ${merchantId} to order ${orderId} (belongs to ${order.user.toString()}).`);
      return res.status(403).json({ message: 'Acesso negado. Este pedido não pertence ao usuário autenticado.' });
    }
    
    logger.debug(`[GET /api/orders/:id] Order ${orderId} found for merchant ${merchantId}.`);
    res.status(200).json(order);
  } catch (error) {
    logger.error(`[GET /api/orders/:id] Error fetching order ${orderId} for merchant ${merchantId}: ${error.message}`, { stack: error.stack });
    res.status(500).json({ message: 'Erro ao buscar pedido.' });
  }
});


export default router;
