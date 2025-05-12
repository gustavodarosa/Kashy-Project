// z:\Kashy-Project\backend\src\controllers\walletController.js
const { validationResult } = require('express-validator');
const Transaction = require('../models/transaction'); // Model for DB operations
const User = require('../models/user'); // Needed for some sales calculations
const walletService = require('../services/walletService'); // Use the main service

const bchService = require('../services/bchService');

const { getBchToBrlRate } = require('../services/exchangeRate'); // Import BRL rate function
const Transaction = require('../models/transaction'); // Supondo que exista um modelo de transações

const User = require('../models/user');
// --- MODIFICATION: Use walletService for core logic ---
const walletService = require('../services/walletService');
// const bchService = require('../services/bchService'); // Commented out - use walletService instead
// --- END MODIFICATION ---
const logger = require('../utils/logger');
// --- ADDED: Import qrcode library ---
const qrcode = require('qrcode');
// const bchService = require('../services/bchService'); // Keep commented out or remove if not used directly

// --- Helper Function (Keep existing) ---
function formatAddress(address) {
    // ... (keep existing formatAddress function) ...
    if (!address || typeof address !== 'string') return 'Endereço Inválido';
    if (address.includes(':') && address.length > 20) {
        const parts = address.split(':'); const addrPart = parts[1];
        if (addrPart && addrPart.length > 15) return `${parts[0]}:${addrPart.substring(0, 10)}...${addrPart.substring(addrPart.length - 5)}`;
    }
    if (address.length > 20) return `${address.substring(0, 10)}...${address.substring(address.length - 5)}`;
    return address;
}

// --- Existing getWalletData (Consider deprecating in favor of specific endpoints) ---
const getWalletData = async (req, res) => {
    const endpoint = '/api/wallet (GET)';
    const userId = req.userId; // Use req.userId from updated authMiddleware
    if (!userId) {
        logger.error(`[${endpoint}] Error: userId not found in req.user.`);
        return res.status(401).json({ message: 'User not identified' });
    }
    logger.warn(`[${endpoint}] User ID: ${userId} - Using DEPRECATED endpoint. Fetching combined wallet data.`);

    try {
        // --- MODIFICATION: Instantiate WalletService ---
        const walletServiceInstance = new WalletService(userId);
        // Fetch data using the new service functions for consistency
        const [address, balance, transactionsResult] = await Promise.all([
            walletServiceInstance.getWalletAddress(),
            walletServiceInstance.getWalletBalance(),
            walletServiceInstance.getWalletTransactions() // Default page/limit
        ]);

        const walletData = {
            balance: balance, // Use the structure from walletService.getWalletBalance
            transactions: transactions, // Use the structure from walletService.getWalletTransactions
            address: address,
        };
        res.status(200).json(walletData);
        logger.info(`[${endpoint}] User ID: ${userId} - Successfully sent combined wallet data (legacy endpoint).`);

    } catch (error) {
        logger.error(`[${endpoint}] Error fetching combined wallet data for user ${userId}: ${error.message}`);
        logger.error(error.stack);
        res.status(500).json({ message: 'Erro interno no servidor ao obter dados da carteira.', error: error.message });
    }
};


// --- NEW: getAddress Controller (Uses walletService) ---
const getAddress = async (req, res, next) => {
    const endpoint = '/api/wallet/address (GET)';
    const userId = req.userId; // Use req.userId from updated authMiddleware
    if (!userId) {
        logger.error(`[${endpoint}] Error: userId not found in req.user.`);
        return res.status(401).json({ message: 'User not identified' });
    }
    logger.info(`[${endpoint}] User ID: ${userId} - Fetching address.`);

    try {
        // --- MODIFICATION: Instantiate and use WalletService ---
        const walletServiceInstance = new WalletService(userId);
        const address = await walletServiceInstance.getWalletAddress();

        res.status(200).json({ address: address });
        logger.info(`[${endpoint}] User ID: ${userId} - Successfully sent address: ${address}`);

    } catch (error) {
        logger.error(`[${endpoint}] Error fetching address for user ${userId}: ${error.message}`);
        logger.error(error.stack);
        // Determine appropriate status code based on error if possible
        const statusCode = error.message.includes('not configured') || error.message.includes('not found') ? 404 : 500;
        res.status(statusCode).json({ message: error.message || 'Server error fetching address' });
    }
};

// --- NEW: getBalance Controller (Uses walletService) ---
const getBalance = async (req, res, next) => {
    const endpoint = '/api/wallet/balance (GET)';
    const userId = req.userId; // Use req.userId from updated authMiddleware
    if (!userId) {
        logger.error(`[${endpoint}] Error: userId not found in req.user.`);
        return res.status(401).json({ message: 'User not identified' });
    }
    logger.info(`[${endpoint}] User ID: ${userId} - Fetching balance.`);

    try {
        // --- MODIFICATION: Instantiate and use WalletService ---
        const walletServiceInstance = new WalletService(userId);
        const balanceResponse = await walletServiceInstance.getWalletBalance();

        res.status(200).json(balanceResponse);
        logger.info(`[${endpoint}] User ID: ${userId} - Successfully sent balance data: ${JSON.stringify(balanceResponse)}`);

    } catch (error) {
        logger.error(`[${endpoint}] Error fetching balance for user ${userId}: ${error.message}`);
        logger.error(error.stack);
        // Determine appropriate status code based on error if possible
        const statusCode = error.message.includes('not configured') || error.message.includes('not found') ? 404 : 500;
        res.status(statusCode).json({ message: error.message || 'Server error fetching balance' });
    }
};

// --- UPDATED: getTransactions Controller with Integrity Check & Sync ---
const getTransactions = async (req, res, next) => {
    const endpoint = '/api/wallet/transactions (GET)';
    const userId = req.userId; // Use req.userId from updated authMiddleware
    if (!userId) {
        logger.error(`[${endpoint}] Error: userId not found in req.user.`);
        return res.status(401).json({ message: 'User not identified' });
    }

    // Pagination Logic
    const limit = parseInt(req.query.limit) || 20; // Default limit 20
    const page = parseInt(req.query.page) || 1;    // Default page 1
    const skip = (page - 1) * limit;
    logger.info(`[${endpoint}] User ID: ${userId} - Fetching transactions. Page: ${page}, Limit: ${limit}`);

    try {
        // --- MODIFICATION: Instantiate WalletService ---
        const walletServiceInstance = new WalletService(userId);

        // Integrity check and sync are now handled *inside* getWalletTransactions
        // logger.info(`[${endpoint}] User ${userId}: Checking transaction integrity...`); // Moved to service
        // logger.info(`[${endpoint}] User ${userId}: Integrity OK / Sync Triggered.`); // Moved to service

        // 3. ALWAYS Fetch transactions using the service function, which handles processing, saving, and pagination
        logger.info(`[${endpoint}] User ID: ${userId} - Calling walletService.getWalletTransactions for paginated data.`);
        const { transactions, totalCount } = await walletServiceInstance.getWalletTransactions(page, limit);
        // The service now returns both the paginated transactions and the total count

        // 4. Return paginated result
        res.status(200).json({
            transactions: transactions, // Use the list returned by the service
            total: totalCount,
            page: page,
            limit: limit,
            totalPages: Math.ceil(totalCount / limit)
        });
        const sentCount = Array.isArray(transactions) ? transactions.length : 0;
        logger.info(`[${endpoint}] User ID: ${userId} - Successfully sent ${sentCount} transactions (Page ${page}/${Math.ceil(totalCount/limit)}).`);

    } catch (error) {
        logger.error(`[${endpoint}] User ID: ${userId}: Error during transaction fetch/check/sync: ${error.message}`, error.stack);
        // --- FIX: Only send error response if headers haven't been sent yet ---
        if (!res.headersSent) {
            res.status(500).json({ message: 'Error fetching transaction history.', error: error.message });
        }
    }
};
// --- END UPDATED getTransactions ---


// --- UPDATED: sendBCH Controller (Uses walletService) ---
const sendBCH = async (req, res) => {
    const endpoint = '/api/wallet/send (POST)';
    const userId = req.userId; // Use req.userId from updated authMiddleware
    if (!userId) {
        logger.error(`[${endpoint}] Error: userId not found in req.user.`);
        return res.status(401).json({ message: 'User not identified' });
    }

    // Input validation (using express-validator or manually)
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      logger.warn(`[${endpoint}] User ID: ${userId} - Validation failed: ${JSON.stringify(errors.array())}`);
      return res.status(400).json({ message: "Validation failed", errors: errors.array() });
    }

    // Get address, amount, AND fee from body
    const { address: recipientAddress, amount: amountBchStr, fee: feeLevel } = req.body;
    logger.info(`[${endpoint}] User ID: ${userId} - Received send request: To=${recipientAddress}, Amount=${amountBchStr}, FeeLevel=${feeLevel}`);

    // Basic validation (walletService.sendTransaction will do more thorough checks)
    if (!recipientAddress || !amountBchStr || !feeLevel) {
        logger.warn(`[${endpoint}] User ID: ${userId} - Bad Request: Missing fields (address, amount, or fee).`);
        return res.status(400).json({ message: 'Missing required fields: address, amount, fee' });
    }
    if (!['low', 'medium', 'high'].includes(feeLevel)) {
        logger.warn(`[${endpoint}] User ID: ${userId} - Bad Request: Invalid fee level: ${feeLevel}`);
        return res.status(400).json({ message: 'Invalid fee level. Use low, medium, or high.' });
    }
    // --- End Basic Validation ---

    try {
        // --- MODIFICATION: Instantiate and use WalletService ---
        const walletServiceInstance = new WalletService(userId);
        // Delegate sending logic entirely to walletService
        const result = await walletServiceInstance.sendTransaction(recipientAddress, amountBchStr, feeLevel);

        logger.info(`[${endpoint}] User ID: ${userId} - Transaction sent successfully via walletService. TXID: ${result.txid}`);
        res.status(200).json({ txid: result.txid, message: 'Transação enviada com sucesso!' });

    } catch (error) {
        // Log the specific error from walletService
        logger.error(`[${endpoint}] Error sending transaction via walletService for user ${userId}: ${error.message}`);
        logger.error(error.stack); // Log stack for debugging

        // Provide a user-friendly error message based on the error type if possible
        let statusCode = 500; // Default to Internal Server Error
        let clientMessage = 'Erro interno no servidor ao enviar BCH.';

        // Map specific errors from walletService to better client messages/status codes
        if (error.message.includes('Insufficient funds')) { // Match errors thrown by the service
            statusCode = 400; // Bad Request
            clientMessage = 'Saldo insuficiente para cobrir o valor e a taxa da transação.';
        } else if (error.message.includes('Invalid recipient address')) {
            statusCode = 400;
            clientMessage = 'Endereço de destino inválido.';
        } else if (error.message.includes('below dust threshold')) {
            statusCode = 400;
            clientMessage = 'O valor da transação é muito pequeno (abaixo do limite mínimo).';
        } else if (error.message.includes('Invalid amount')) {
             statusCode = 400;
             clientMessage = 'Valor inválido especificado.';
        } else if (error.message.includes('Network error')) { // Match errors thrown by the service
             statusCode = 503; // Service Unavailable
             clientMessage = 'Erro de rede durante o envio da transação. Verifique seu histórico de transações mais tarde para confirmar o status.';
        } else if (error.message.includes('Failed to access or derive wallet keys')) { // Match errors thrown by the service
            // This indicates a server config issue or problem fetching keys
            statusCode = 500;
            clientMessage = 'Erro ao acessar a chave da carteira no servidor.';
        } else if (error.message.includes('Failed to send transaction')) {
            // Keep the generic message from walletService if it's not one of the above
            clientMessage = error.message;
        }

        res.status(statusCode).json({ message: clientMessage, error: error.message }); // Include original error message for context
    }
};

const getTotalSalesToday = async (req, res) => {
  const endpoint = '/api/wallet/sales/today (GET)';
  const userId = req.userId; // Use req.userId from updated authMiddleware
  if (!userId) {
      logger.error(`[${endpoint}] Error: userId not found in req.user.`);
      return res.status(401).json({ message: 'User not identified' });
  }
  logger.info(`[${endpoint}] User ID: ${userId} - Calculating total sales for today.`);

  try {
    const userId = req.user.id;
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    const totalSales = await Transaction.aggregate([
      { $match: { userId, status: 'confirmed', createdAt: { $gte: startOfDay } } },
      { $group: { _id: null, totalBRL: { $sum: '$amountBRL' } } },
    ]);

    const total = totalSales[0]?.totalBRL || 0;
    res.status(200).json({ total });
  } catch (error) {
    console.error('Erro ao calcular vendas de hoje:', error);
    res.status(500).json({ message: 'Erro ao calcular vendas de hoje' });
  }
};

const getTotalSales = async (req, res) => {
  const endpoint = '/api/wallet/sales/total (GET)';
  const userId = req.userId; // Use req.userId from updated authMiddleware
  if (!userId) {
      logger.error(`[${endpoint}] Error: userId not found in req.user.`);
      return res.status(401).json({ message: 'User not identified' });
  }
  logger.info(`[${endpoint}] User ID: ${userId} - Calculating total sales (all time).`);

  try {
    const userId = req.user.id;

    // Obtenha o endereço BCH do usuário
    const user = await User.findById(userId).select('bchAddress');
    if (!user || !user.bchAddress) {
      return res.status(404).json({ message: 'Endereço BCH não encontrado para o usuário.' });
    }

    const bchAddress = user.bchAddress;

    // Use o serviço BCH para buscar o histórico de transações
    const transactions = await bchService.getTransactionHistoryFromElectrum(bchAddress);

    // Filtre apenas as transações confirmadas e calcule o total
    const totalSales = transactions
      .filter(tx => tx.type === 'received' && tx.status === 'confirmed')
      .reduce((sum, tx) => sum + tx.amountBRL, 0);

    res.status(200).json({ total: totalSales });
  } catch (error) {
    console.error('Erro ao calcular total de vendas:', error);
    res.status(500).json({ message: 'Erro ao calcular total de vendas' });
  }
};

const getTotalSalesInBCH = async (req, res) => {
  const endpoint = '/api/wallet/sales/total-bch (GET)';
  const userId = req.userId; // Use req.userId from updated authMiddleware
  if (!userId) {
      logger.error(`[${endpoint}] Error: userId not found in req.user.`);
      return res.status(401).json({ message: 'User not identified' });
  }
  logger.info(`[${endpoint}] User ID: ${userId} - Calculating total sales in BCH (all time).`);

  try {
    const userId = req.user.id;

    // Obtenha o endereço BCH do usuário
    const user = await User.findById(userId).select('bchAddress');
    if (!user || !user.bchAddress) {
      return res.status(404).json({ message: 'Endereço BCH não encontrado para o usuário.' });
    }

    const bchAddress = user.bchAddress;

    // Use o serviço BCH para buscar o histórico de transações
    const transactions = await bchService.getTransactionHistoryFromElectrum(bchAddress);

    // Filtre apenas as transações confirmadas e calcule o total em BCH
    const totalBCH = transactions
      .filter(tx => tx.type === 'received' && tx.status === 'confirmed')
      .reduce((sum, tx) => sum + tx.amountBCH, 0);

    res.status(200).json({ total: totalBCH });
  } catch (error) {
    console.error('Erro ao calcular total de vendas em BCH:', error);
    res.status(500).json({ message: 'Erro ao calcular total de vendas em BCH' });
  }
};

// --- ADDED: markTransactionAsSeen Controller ---
async function markTransactionAsSeen(req, res) {
  const endpoint = '/api/wallet/transactions/:txid/seen (PATCH)';
  const userId = req.userId; // Use req.userId from updated authMiddleware
  const txid = req.params.txid;

  if (!userId) {
    logger.error(`[${endpoint}] Error: userId not found in req.user.`);
    return res.status(401).json({ message: 'User not identified' });
  }
  if (!txid) {
    logger.warn(`[${endpoint}] User ID: ${userId} - Missing txid parameter.`);
    return res.status(400).json({ message: 'Transaction ID is required' });
  }
  logger.info(`[${endpoint}] User ID: ${userId} - Marking transaction ${txid} as seen.`);

  try {
    // --- MODIFICATION: Instantiate and use WalletService ---
    const walletServiceInstance = new WalletService(userId);
    const tx = await walletServiceInstance.markTransactionAsSeen(txid);
    // Service method now handles finding and updating

    if (!tx) {
        // This case should now be handled by the service throwing an error
        logger.warn(`[${endpoint}] User ID: ${userId} - Transaction ${txid} not found or doesn't belong to user.`);
        // The service error will be caught below
        return res.status(404).json({ message: 'Transaction not found or access denied' });
    }
    logger.info(`[${endpoint}] User ID: ${userId} - Successfully marked transaction ${txid} as seen.`);
    res.status(200).json(tx); // Return the updated transaction
  } catch (err) {
    logger.error(`[${endpoint}] User ID: ${userId} - Error marking transaction ${txid} as seen: ${err.message}`);
    logger.error(err.stack);
    // Handle specific error from service
    if (err.message.includes('Transaction not found or access denied')) {
        return res.status(404).json({ message: err.message });
    }
    // Generic server error for other issues
    res.status(500).json({ message: 'Erro ao marcar transação como vista', error: err.message });
  }
}
// --- END ADDED ---

// --- ADDED: Generate Payment QR Controller ---
async function generatePaymentQR(req, res) {
    const endpoint = '/api/wallet/payment-request (GET)';
    const userId = req.userId;
    if (!userId) {
        // This should be caught by authMiddleware, but double-check
        logger.error(`[${endpoint}] User not identified in request`, { userId });
        return res.status(401).json({ message: 'User not identified' });
    }

    // Check validation results from the route definition
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        logger.warn(`[${endpoint}] Validation failed`, { userId, errors: errors.array() });
        return res.status(400).json({ message: "Validation failed", errors: errors.array() });
    }

    // Get validated query parameters
    const { amount, label } = req.query; // amount is already float due to validation
    logger.info(`[${endpoint}] Generating payment QR request`, { userId, amount, label });

    try {
        const walletServiceInstance = new WalletService(userId);
        const address = await walletServiceInstance.getWalletAddress();

        // Construct BIP-21 URI: bitcoincash:address?amount=XXX&label=YYY
        let uri = `bitcoincash:${address}`;
        const params = new URLSearchParams();
        if (amount) {
            // Ensure amount has correct decimal places for BCH (8)
            params.append('amount', parseFloat(amount).toFixed(8));
        }
        if (label) {
            params.append('label', label); // URLSearchParams handles encoding
        }
        const paramString = params.toString();
        if (paramString) {
            uri += `?${paramString}`;
        }

        logger.debug(`[${endpoint}] Generated URI: ${uri}`, { userId });

        // Generate QR code as a Data URL (base64 encoded image)
        const qrCodeDataURL = await qrcode.toDataURL(uri, { errorCorrectionLevel: 'M', margin: 2 });

        res.status(200).json({ qrCodeDataURL, paymentURI: uri, address, amount, label });
        logger.info(`[${endpoint}] Successfully generated payment QR`, { userId });
    } catch (error) {
        logger.error(`[${endpoint}] Error generating payment QR`, { userId, error: error.message, stack: error.stack });
        res.status(500).json({ message: 'Failed to generate payment QR code', error: error.message });
    }
}
// --- END ADDED ---

// --- Module Exports ---
module.exports = {
    getWalletData, // Keep existing endpoint for now
    getAddress,    // Add new endpoint
    getBalance,    // Add new endpoint
    getTransactions,// Export updated getTransactions
    sendBCH,       // Export updated sendBCH
    getTotalSalesToday,
    getTotalSales,
    getTotalSalesInBCH,
    markTransactionAsSeen, // Export the new function
    generatePaymentQR // <-- ADDED: Export the new QR generator function
};
