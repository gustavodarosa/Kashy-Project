// c:\Users\gustavo.rosa8\Desktop\Kashy-Project\backend\src\controllers\walletController.js

const User = require('../models/user');
const walletService = require('../services/walletService');
const logger = require('../utils/logger');
const { validationResult } = require('express-validator');

// --- Helper Function (Keep existing) ---
function formatAddress(address) {
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
    const userId = req.user?.id;
    if (!userId) {
        logger.error(`[${endpoint}] Error: userId not found in req.user.`);
        return res.status(401).json({ message: 'User not identified' });
    }
    logger.warn(`[${endpoint}] User ID: ${userId} - Using DEPRECATED endpoint. Fetching combined wallet data.`);

    try {
        const [address, balance, transactions] = await Promise.all([
            walletService.getWalletAddress(userId),
            walletService.getWalletBalance(userId),
            walletService.getWalletTransactions(userId)
        ]);

        const walletData = {
            balance: balance,
            transactions: transactions,
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
    const userId = req.user?.id;
    if (!userId) {
        logger.error(`[${endpoint}] Error: userId not found in req.user.`);
        return res.status(401).json({ message: 'User not identified' });
    }
    logger.info(`[${endpoint}] User ID: ${userId} - Fetching address.`);

    try {
        const address = await walletService.getWalletAddress(userId);
        res.status(200).json({ address: address });
        logger.info(`[${endpoint}] User ID: ${userId} - Successfully sent address: ${address}`);
    } catch (error) {
        logger.error(`[${endpoint}] Error fetching address for user ${req.user?.id}: ${error.message}`);
        logger.error(error.stack);
        const statusCode = error.message.includes('not configured') || error.message.includes('not found') ? 404 : 500;
        res.status(statusCode).json({ message: error.message || 'Server error fetching address' });
    }
};

// --- NEW: getBalance Controller (Uses walletService) ---
const getBalance = async (req, res, next) => {
    const endpoint = '/api/wallet/balance (GET)';
    const userId = req.user?.id;
    if (!userId) {
        logger.error(`[${endpoint}] Error: userId not found in req.user.`);
        return res.status(401).json({ message: 'User not identified' });
    }
    logger.info(`[${endpoint}] User ID: ${userId} - Fetching balance.`);

    try {
        const balanceResponse = await walletService.getWalletBalance(userId);
        res.status(200).json(balanceResponse);
        logger.info(`[${endpoint}] User ID: ${userId} - Successfully sent balance data: ${JSON.stringify(balanceResponse)}`);
    } catch (error) {
        logger.error(`[${endpoint}] Error fetching balance for user ${req.user?.id}: ${error.message}`);
        logger.error(error.stack);
        const statusCode = error.message.includes('not configured') || error.message.includes('not found') ? 404 : 500;
        res.status(statusCode).json({ message: error.message || 'Server error fetching balance' });
    }
};

// --- NEW: getTransactions Controller (Uses walletService) ---
const getTransactions = async (req, res, next) => {
    const endpoint = '/api/wallet/transactions (GET)';
    const userId = req.user?.id;
    if (!userId) {
        logger.error(`[${endpoint}] Error: userId not found in req.user.`);
        return res.status(401).json({ message: 'User not identified' });
    }
    logger.info(`[${endpoint}] User ID: ${userId} - Fetching transactions using walletService.`);

    const limit = parseInt(req.query.limit) || 20;
    const page = parseInt(req.query.page) || 1;
    const searchTerm = req.query.search || '';
    const statusFilter = req.query.status || 'all';
    const startDate = req.query.startDate || null;
    const endDate = req.query.endDate || null;

    logger.info(`[${endpoint}] User ID: ${userId} - Fetching transactions. Page: ${page}, Limit: ${limit}, Search: '${searchTerm}', Status: ${statusFilter}, Start: ${startDate}, End: ${endDate}`);

    try {
        logger.info(`[${endpoint}] User ID: ${userId} - Calling walletService.getWalletTransactions with filters and pagination.`);
        const { transactions, totalCount } = await walletService.getWalletTransactions(
            userId,
            page,
            limit,
            searchTerm,
            statusFilter,
            startDate,
            endDate
        );

        res.status(200).json({
            transactions: transactions,
            total: totalCount,
            page: page,
            limit: limit,
            totalPages: Math.ceil(totalCount / limit)
        });
        const sentCount = Array.isArray(transactions) ? transactions.length : 0;
        logger.info(`[${endpoint}] User ID: ${userId} - Successfully sent ${sentCount} transactions (Page ${page}/${Math.ceil(totalCount/limit)}).`);

    } catch (error) {
        logger.error(`[${endpoint}] Error fetching transactions via walletService for user ${userId}: ${error.message}`, error.stack);
        const statusCode = error.message.includes('not configured') || error.message.includes('not found') ? 404 : 500;
        res.status(statusCode).json({ message: error.message || 'Server error fetching transactions' });
    }
};

// --- UPDATED: sendBCH Controller (Uses walletService) ---
const sendBCH = async (req, res) => {
    const endpoint = '/api/wallet/send (POST)';
    const userId = req.user?.id;
    if (!userId) {
        logger.error(`[${endpoint}] Error: userId not found in req.user.`);
        return res.status(401).json({ message: 'User not identified' });
    }

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      logger.warn(`[${endpoint}] User ID: ${userId} - Validation failed: ${JSON.stringify(errors.array())}`);
      return res.status(400).json({ message: "Validation failed", errors: errors.array() });
    }

    const { address: recipientAddress, amount: amountBchStr, fee: feeLevel } = req.body;
    logger.info(`[${endpoint}] User ID: ${userId} - Received send request: To=${recipientAddress}, Amount=${amountBchStr}, FeeLevel=${feeLevel}`);

    if (!recipientAddress || !amountBchStr || !feeLevel) {
        logger.warn(`[${endpoint}] User ID: ${userId} - Bad Request: Missing fields (address, amount, or fee).`);
        return res.status(400).json({ message: 'Missing required fields: address, amount, fee' });
    }
    if (!['low', 'medium', 'high'].includes(feeLevel)) {
        logger.warn(`[${endpoint}] User ID: ${userId} - Bad Request: Invalid fee level: ${feeLevel}`);
        return res.status(400).json({ message: 'Invalid fee level. Use low, medium, or high.' });
    }

    try {
        const result = await walletService.sendTransaction(userId, recipientAddress, amountBchStr, feeLevel);
        logger.info(`[${endpoint}] User ID: ${userId} - Transaction sent successfully via walletService. TXID: ${result.txid}`);
        res.status(200).json({ txid: result.txid, message: 'Transação enviada com sucesso!' });
    } catch (error) {
        logger.error(`[${endpoint}] Error sending transaction via walletService for user ${userId}: ${error.message}`);
        logger.error(error.stack);

        let statusCode = 500;
        let clientMessage = 'Erro interno no servidor ao enviar BCH.';

        if (error.message.includes('Insufficient funds')) {
            statusCode = 400;
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
        } else if (error.message.includes('Network error') || error.message.includes('timeout') || error.message.includes('No connected Electrum servers')) {
             statusCode = 503;
             clientMessage = 'Erro de rede durante o envio da transação. Verifique seu histórico de transações mais tarde para confirmar o status.';
        } else if (error.message.includes('User WIF not configured') || error.message.includes('Failed to initialize wallet keys')) {
            statusCode = 500;
            clientMessage = 'Erro ao acessar a chave da carteira no servidor.';
        } else if (error.message.includes('Failed to send transaction')) {
            clientMessage = error.message;
        }
        res.status(statusCode).json({ message: clientMessage, error: error.message });
    }
};

// --- ADDED: Sales Data Controller Functions ---

// GET /api/wallet/sales/today
const getSalesToday = async (req, res) => {
    const endpoint = '/api/wallet/sales/today (GET)';
    const userId = req.user?.id; // Assuming sales are user-specific, otherwise remove/adjust
    logger.info(`[${endpoint}] User ID: ${userId} - Fetching today's sales.`);

    try {
        // Placeholder: Replace with actual database query
        // Example:
        // const todayStart = new Date();
        // todayStart.setHours(0, 0, 0, 0);
        // const todayEnd = new Date();
        // todayEnd.setHours(23, 59, 59, 999);
        // const sales = await Transaction.aggregate([
        //   { $match: { userId: mongoose.Types.ObjectId(userId), type: 'received', status: 'confirmed', timestamp: { $gte: todayStart, $lte: todayEnd } } },
        //   { $group: { _id: null, total: { $sum: "$amountBRL" } } }
        // ]);
        // const totalSalesToday = sales.length > 0 ? sales[0].total : 0;

        const totalSalesToday = 123.45; // Placeholder value
        res.status(200).json({ total: totalSalesToday });
        logger.info(`[${endpoint}] User ID: ${userId} - Successfully sent today's sales: ${totalSalesToday}`);
    } catch (error) {
        logger.error(`[${endpoint}] User ID: ${userId} - Error fetching today's sales: ${error.message}`, error.stack);
        res.status(500).json({ message: "Erro ao buscar vendas de hoje." });
    }
};

// GET /api/wallet/sales/total
const getTotalSales = async (req, res) => {
    const endpoint = '/api/wallet/sales/total (GET)';
    const userId = req.user?.id;
    logger.info(`[${endpoint}] User ID: ${userId} - Fetching total sales.`);

    try {
        // Placeholder: Replace with actual database query
        // Example:
        // const sales = await Transaction.aggregate([
        //   { $match: { userId: mongoose.Types.ObjectId(userId), type: 'received', status: 'confirmed' } },
        //   { $group: { _id: null, total: { $sum: "$amountBRL" } } }
        // ]);
        // const totalSalesAllTime = sales.length > 0 ? sales[0].total : 0;

        const totalSalesAllTime = 54321.00; // Placeholder value
        res.status(200).json({ total: totalSalesAllTime });
        logger.info(`[${endpoint}] User ID: ${userId} - Successfully sent total sales: ${totalSalesAllTime}`);
    } catch (error) {
        logger.error(`[${endpoint}] User ID: ${userId} - Error fetching total sales: ${error.message}`, error.stack);
        res.status(500).json({ message: "Erro ao buscar total de vendas." });
    }
};

// GET /api/wallet/sales/total-bch
const getTotalBCHReceived = async (req, res) => {
    const endpoint = '/api/wallet/sales/total-bch (GET)';
    const userId = req.user?.id;
    logger.info(`[${endpoint}] User ID: ${userId} - Fetching total BCH received.`);

    try {
        // Placeholder: Replace with actual database query
        // Example:
        // const bchReceived = await Transaction.aggregate([
        //   { $match: { userId: mongoose.Types.ObjectId(userId), type: 'received', status: 'confirmed' } },
        //   { $group: { _id: null, total: { $sum: "$amountBCH" } } }
        // ]);
        // const totalBCH = bchReceived.length > 0 ? bchReceived[0].total : 0;

        const totalBCH = 2.71828; // Placeholder value
        res.status(200).json({ total: totalBCH });
        logger.info(`[${endpoint}] User ID: ${userId} - Successfully sent total BCH received: ${totalBCH}`);
    } catch (error) {
        logger.error(`[${endpoint}] User ID: ${userId} - Error fetching total BCH received: ${error.message}`, error.stack);
        res.status(500).json({ message: "Erro ao buscar total de BCH recebido." });
    }
};

// GET /api/wallet/sales/weekly
const getWeeklySalesData = async (req, res) => {
    const endpoint = '/api/wallet/sales/weekly (GET)';
    const userId = req.user?.id;
    logger.info(`[${endpoint}] User ID: ${userId} - Fetching weekly sales data.`);

    try {
        // Placeholder: Replace with actual database query
        // This would involve grouping sales by day for the last 7 days.
        // Example:
        // const weeklyData = [];
        // for (let i = 6; i >= 0; i--) {
        //     const dayStart = new Date();
        //     dayStart.setDate(dayStart.getDate() - i);
        //     dayStart.setHours(0, 0, 0, 0);
        //     const dayEnd = new Date(dayStart);
        //     dayEnd.setHours(23, 59, 59, 999);
        //
        //     const dailySale = await Transaction.aggregate([
        //         { $match: { userId: mongoose.Types.ObjectId(userId), type: 'received', status: 'confirmed', timestamp: { $gte: dayStart, $lte: dayEnd } } },
        //         { $group: { _id: null, sales: { $sum: "$amountBRL" } } }
        //     ]);
        //     weeklyData.push({
        //         day: dayStart.toISOString().split('T')[0], // Format as YYYY-MM-DD
        //         sales: dailySale.length > 0 ? dailySale[0].sales : 0
        //     });
        // }

        const weeklyData = [ // Placeholder data
            { day: "2024-07-01", sales: 150.00 },
            { day: "2024-07-02", sales: 220.50 },
            { day: "2024-07-03", sales: 180.00 },
            { day: "2024-07-04", sales: 300.75 },
            { day: "2024-07-05", sales: 250.00 },
            { day: "2024-07-06", sales: 120.00 },
            { day: "2024-07-07", sales: 190.25 },
        ];
        res.status(200).json(weeklyData);
        logger.info(`[${endpoint}] User ID: ${userId} - Successfully sent weekly sales data.`);
    } catch (error) {
        logger.error(`[${endpoint}] User ID: ${userId} - Error fetching weekly sales data: ${error.message}`, error.stack);
        res.status(500).json({ message: "Erro ao buscar dados de vendas semanais." });
    }
};

// --- END ADDED: Sales Data Controller Functions ---


// --- Module Exports ---
module.exports = {
    getWalletData,
    getAddress,
    getBalance,
    getTransactions,
    sendBCH,
    // --- ADDED: Export new sales functions ---
    getSalesToday,
    getTotalSales,
    getTotalBCHReceived,
    getWeeklySalesData
    // --- END ADDED ---
};
