// z:\Kashy-Project\backend\src\controllers\walletController.js

const bchService = require('../services/bchService'); // Mantenha para getCurrentBlockHeight

const { getBchToBrlRate } = require('../services/exchangeRate'); // Import BRL rate function
const Transaction = require('../models/transaction'); // Supondo que exista um modelo de transações

const User = require('../models/user');
// --- MODIFICATION: Use walletService for core logic ---
const walletService = require('../services/walletService');
// const bchService = require('../services/bchService'); // Commented out - use walletService instead
// --- END MODIFICATION ---
const logger = require('../utils/logger');
const { validationResult } = require('express-validator'); // Keep if using validation

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
    const userId = req.user?.id;
    if (!userId) {
        logger.error(`[${endpoint}] Error: userId not found in req.user.`);
        return res.status(401).json({ message: 'User not identified' });
    }
    logger.warn(`[${endpoint}] User ID: ${userId} - Using DEPRECATED endpoint. Fetching combined wallet data.`);

    try {
        // Fetch data using the new service functions for consistency
        const [address, balance, transactions] = await Promise.all([
            walletService.getWalletAddress(userId),
            walletService.getWalletBalance(userId),
            walletService.getWalletTransactions(userId) // Use the accurate transaction fetch
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
const getAddress = async (req, res) => {
  const endpoint = '/api/wallet/address (GET)';
  const userId = req.user?.id;

  if (!userId) {
    logger.error(`[${endpoint}] Erro: userId não encontrado em req.user.`);
    return res.status(401).json({ message: 'Usuário não identificado.' });
  }

  logger.info(`[${endpoint}] Buscando endereço BCH para o usuário: ${userId}`);

  try {
    const address = await walletService.getWalletAddress(userId);
    logger.info(`[${endpoint}] Endereço BCH retornado para o usuário ${userId}: ${address}`);
    res.status(200).json({ address });
  } catch (error) {
    logger.error(`[${endpoint}] Erro ao buscar endereço BCH para o usuário ${userId}: ${error.message}`);
    res.status(500).json({ message: 'Erro ao buscar endereço BCH.' });
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
        // Fetch live balance using walletService
        const balanceResponse = await walletService.getWalletBalance(userId);

        res.status(200).json(balanceResponse);
        logger.info(`[${endpoint}] User ID: ${userId} - Successfully sent balance data: ${JSON.stringify(balanceResponse)}`);

    } catch (error) {
        logger.error(`[${endpoint}] Error fetching balance for user ${req.user?.id}: ${error.message}`);
        logger.error(error.stack);
        // Determine appropriate status code based on error if possible
        const statusCode = error.message.includes('not configured') || error.message.includes('not found') ? 404 : 500;
        res.status(statusCode).json({ message: error.message || 'Server error fetching balance' });
    }
};

// --- NEW: getTransactions Controller (Uses walletService) ---
// --- !!! THIS IS THE CORRECTED FUNCTION !!! ---
const getTransactions = async (req, res, next) => {
    const endpoint = '/api/wallet/transactions (GET)';
    const userId = req.user?.id;
    console.log(`[WalletController] Buscando transações para o usuário: ${userId} (via walletService)`);
    if (!userId) {
        logger.error(`[${endpoint}] Error: userId not found in req.user.`);
        return res.status(401).json({ message: 'User not identified' });
    }
    logger.info(`[${endpoint}] User ID: ${userId} - Fetching transactions using walletService.`);

    try {
        const transactions = await walletService.getWalletTransactions(userId);
        console.log(`[WalletController] walletService.getWalletTransactions retornou ${transactions.length} transações.`);

        // --- NEW: Sync live transactions to local DB (SEQUENTIAL DEBUGGING) ---
        if (transactions && transactions.length > 0) {
            logger.info(`[WalletController - Sync] Starting sequential sync for ${transactions.length} transactions...`);
            
            // Use a sequential for...of loop for debugging instead of Promise.all
            for (const tx of transactions) {
                try {
                    console.log(`[WalletController - Sync] Processing raw tx from walletService: ${JSON.stringify(tx)}`);
                    
                    // Explicitly map all fields to ensure correct types and handle potential undefined/null values.
                    const finalMappedTx = {
                        user: userId,
                        txid: String(tx.txid || ''),
                        type: tx.type === 'received' ? 'incoming' : (tx.type === 'sent' ? 'outgoing' : 'internal'),
                        amountSatoshis: typeof tx.amountSatoshis === 'number' ? tx.amountSatoshis : 0,
                        amountBCH: typeof tx.amountBCH === 'number' ? tx.amountBCH : 0,
                        amountBRL: typeof tx.amountBRL === 'number' ? tx.amountBRL : 0,
                        address: String(tx.address || ''),
                        status: String(tx.status || 'pending'),
                        blockHeight: typeof tx.blockHeight === 'number' ? tx.blockHeight : 0,
                        timestamp: (tx.timestamp && !isNaN(new Date(tx.timestamp))) ? new Date(tx.timestamp) : null,
                        confirmations: typeof tx.confirmations === 'number' ? tx.confirmations : 0,
                        feeBCH: typeof tx.feeBCH === 'number' ? tx.feeBCH : 0,
                    };

                    console.log(`[WalletController - Sync] Final mapped tx for DB: ${JSON.stringify(finalMappedTx)}`);

                    await Transaction.updateOne(
                        { txid: finalMappedTx.txid, user: userId },
                        { $set: finalMappedTx },
                        { upsert: true }
                    );

                    console.log(`[WalletController - Sync] Successfully synced txid: ${finalMappedTx.txid}`);

                } catch (dbError) {
                    // This will catch Mongoose validation errors or other JS errors during the updateOne call
                    logger.error(`[/api/wallet/transactions (GET)] CATCHABLE ERROR syncing txid ${tx.txid} for user ${userId}:`);
                    logger.error(`  Name: ${dbError.name}`);
                    logger.error(`  Message: ${dbError.message}`);
                    // We log the error but continue the loop to process other transactions
                }
            }
            logger.info(`[/api/wallet/transactions (GET)] Finished sequential sync attempt for user ${userId}.`);
        }
        // --- END OF SYNC LOGIC ---

        console.log(`[WalletController] Transactions to be sent to frontend: ${JSON.stringify(transactions)}`);
        res.status(200).json(transactions);
        logger.info(`[${endpoint}] User ID: ${userId} - Successfully sent ${transactions.length} transactions.`);

    } catch (error) {
        logger.error(`[${endpoint}] Error fetching transactions via walletService for user ${userId}: ${error.message}`, error.stack);
        const statusCode = error.message.includes('not configured') || error.message.includes('not found') ? 404 : 500;
        res.status(statusCode).json({ message: error.message || 'Server error fetching transactions' });
    }
};
// --- !!! END OF CORRECTION !!! ---


// --- UPDATED: sendBCH Controller (Uses walletService) ---
const sendBCH = async (req, res) => {
    const endpoint = '/api/wallet/send (POST)';
    const userId = req.user?.id;
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
        return res.status(400).json({ message: 'Missing required fields: address, amount, or fee' });
    }
    if (!['low', 'medium', 'high'].includes(feeLevel)) {
        logger.warn(`[${endpoint}] User ID: ${userId} - Bad Request: Invalid fee level: ${feeLevel}`);
        return res.status(400).json({ message: 'Invalid fee level. Use low, medium, or high.' });
    }
    // --- End Basic Validation ---

    try {
        // Delegate sending logic entirely to walletService
        const result = await walletService.sendTransaction(userId, recipientAddress, amountBchStr, feeLevel);

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
        if (error.message.includes('Insufficient funds')) {
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
        } else if (error.message.includes('Network error') || error.message.includes('timeout') || error.message.includes('No connected Electrum servers')) {
             statusCode = 503; // Service Unavailable
             clientMessage = 'Erro de rede durante o envio da transação. Verifique seu histórico de transações mais tarde para confirmar o status.';
        } else if (error.message.includes('User WIF not configured') || error.message.includes('Failed to initialize wallet keys')) {
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
  try {
    const userId = req.user.id;
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    const totalSales = await Transaction.aggregate([
      { $match: { user: userId, status: 'confirmed', createdAt: { $gte: startOfDay } } },
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

// --- Module Exports ---
module.exports = {
    getWalletData, // Keep existing endpoint for now
    getAddress,    // Add new endpoint
    getBalance,    // Add new endpoint
    getTransactions,// Add new endpoint
    sendBCH,       // Export updated sendBCH
    getTotalSalesToday, // Export new getTotalSalesToday
    getTotalSales, // Exporta a nova função
    getTotalSalesInBCH, // Exporta a nova função
};
