// z:\Kashy-Project\backend\src\controllers\walletController.js
const User = require('../models/user');
const bchService = require('../services/bchService');
const logger = require('../utils/logger');
const { getBchToBrlRate } = require('../services/exchangeRate'); // Import BRL rate function
const Transaction = require('../models/transaction'); // Supondo que exista um modelo de transações

const SATOSHIS_PER_BCH = 1e8;
const DUST_THRESHOLD_SATOSHIS = 546;

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

// --- Existing getWalletData (Keep for now, maybe deprecate later) ---
const getWalletData = async (req, res) => {
    const endpoint = '/api/wallet (GET)';
    try {
        const userId = req.user?.id;
        if (!userId) { /* ... auth check ... */ }
        logger.info(`[${endpoint}] User ID: ${userId} - Fetching wallet data (legacy endpoint).`);
        const user = await User.findById(userId).select('bchAddress balance');
        if (!user) { /* ... user check ... */ }

        logger.info(`[${endpoint}] User ID: ${userId} - Fetching live transactions from Electrum for ${user.bchAddress}...`);
        let transactions = [];
        try {
            // Use bchService to get history (format might differ from new getTransactions)
            transactions = await bchService.getTransactionHistoryFromElectrum(user.bchAddress, 50);
            logger.info(`[${endpoint}] User ID: ${userId} - Found ${transactions.length} live transactions.`);
        } catch (txFetchError) {
            logger.error(`[${endpoint}] User ID: ${userId} - Failed to fetch live transactions: ${txFetchError.message}`);
        }

        const confirmedSatoshis = user.balance || 0;
        const balanceData = {
            confirmedBCH: confirmedSatoshis / SATOSHIS_PER_BCH,
            unconfirmedBCH: 0, // This endpoint doesn't fetch live unconfirmed balance
            totalBCH: confirmedSatoshis / SATOSHIS_PER_BCH
        };
        logger.info(`[${endpoint}] User ID: ${userId} - Calculated balance from DB: ${JSON.stringify(balanceData)}`);

        const walletData = {
            balance: balanceData,
            transactions: transactions, // Note: Format might not match frontend's AppTransaction exactly
            address: user.bchAddress,
        };
        res.status(200).json(walletData);
        logger.info(`[${endpoint}] User ID: ${userId} - Successfully sent wallet data (legacy endpoint).`);

    } catch (error) {
        logger.error(`[${endpoint}] Error fetching wallet data for user ${req.user?.id}: ${error.message}`);
        logger.error(error.stack);
        res.status(500).json({ message: 'Erro interno no servidor ao obter dados da carteira.', error: error.message });
    }
};


// --- NEW: getAddress Controller ---
const getAddress = async (req, res, next) => {
    const endpoint = '/api/wallet/address (GET)';
    try {
        const userId = req.user?.id;
        if (!userId) {
            logger.error(`[${endpoint}] Error: userId not found in req.user.`);
            return res.status(401).json({ message: 'User not identified' });
        }
        logger.info(`[${endpoint}] User ID: ${userId} - Fetching address.`);

        // Fetch user to get the address
        const user = await User.findById(userId).select('bchAddress');
        if (!user || !user.bchAddress) {
            logger.error(`[${endpoint}] Error: User or address not found for ID: ${userId}`);
            return res.status(404).json({ message: 'User or wallet address not found.' });
        }

        res.status(200).json({ address: user.bchAddress });
        logger.info(`[${endpoint}] User ID: ${userId} - Successfully sent address: ${user.bchAddress}`);

    } catch (error) {
        logger.error(`[${endpoint}] Error fetching address for user ${req.user?.id}: ${error.message}`);
        logger.error(error.stack);
        res.status(500).json({ message: error.message || 'Server error fetching address' });
    }
};

// --- NEW: getBalance Controller ---
const getBalance = async (req, res, next) => {
    const endpoint = '/api/wallet/balance (GET)';
    try {
        const userId = req.user?.id;
        if (!userId) {
            logger.error(`[${endpoint}] Error: userId not found in req.user.`);
            return res.status(401).json({ message: 'User not identified' });
        }
        logger.info(`[${endpoint}] User ID: ${userId} - Fetching balance.`);

        // Fetch user to get the address
        const user = await User.findById(userId).select('bchAddress');
        if (!user || !user.bchAddress) {
            logger.error(`[${endpoint}] Error: User or address not found for ID: ${userId}`);
            return res.status(404).json({ message: 'User or wallet address not found.' });
        }

        // Fetch live balance using bchService
        const liveBalance = await bchService.getBalance(user.bchAddress);
        const rate = await getBchToBrlRate(); // Fetch current BRL rate

        const confirmedSatoshis = Math.round((liveBalance.balance || 0) * SATOSHIS_PER_BCH);
        const unconfirmedSatoshis = Math.round((liveBalance.unconfirmedBalance || 0) * SATOSHIS_PER_BCH);
        const totalSatoshis = confirmedSatoshis + unconfirmedSatoshis;

        const availableBCH = confirmedSatoshis / SATOSHIS_PER_BCH;
        const pendingBCH = unconfirmedSatoshis / SATOSHIS_PER_BCH;
        const totalBCH = totalSatoshis / SATOSHIS_PER_BCH;
        const totalBRL = totalBCH * rate;

        // Construct response matching frontend's AppWalletBalance type
        const balanceResponse = {
            totalBCH,
            availableBCH,
            pendingBCH,
            totalBRL,
            totalSatoshis,
            currentRateBRL: rate,
        };

        res.status(200).json(balanceResponse);
        logger.info(`[${endpoint}] User ID: ${userId} - Successfully sent balance data: ${JSON.stringify(balanceResponse)}`);

    } catch (error) {
        logger.error(`[${endpoint}] Error fetching balance for user ${req.user?.id}: ${error.message}`);
        logger.error(error.stack);
        res.status(500).json({ message: error.message || 'Server error fetching balance' });
    }
};

// --- NEW: getTransactions Controller ---
const getTransactions = async (req, res, next) => {
    const endpoint = '/api/wallet/transactions (GET)';
    try {
        const userId = req.user?.id;
        if (!userId) {
            logger.error(`[${endpoint}] Error: userId not found in req.user.`);
            return res.status(401).json({ message: 'User not identified' });
        }
        logger.info(`[${endpoint}] User ID: ${userId} - Fetching transactions.`);

        // Fetch user to get the address
        const user = await User.findById(userId).select('bchAddress');
        if (!user || !user.bchAddress) {
            logger.error(`[${endpoint}] Error: User or address not found for ID: ${userId}`);
            return res.status(404).json({ message: 'User or wallet address not found.' });
        }

        // TODO: Get pagination params from req.query if implemented
        // const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 50; // Default limit 50

        // Fetch live transactions using bchService
        const rawTransactions = await bchService.getTransactionHistoryFromElectrum(user.bchAddress, limit);
        const rate = await getBchToBrlRate(); // Fetch current BRL rate

        // Map rawTransactions to the frontend's AppTransaction format
        const formattedTransactions = rawTransactions.map(tx => {
            // Determine type and address based on raw data (needs refinement based on bchService output)
            // This mapping is based on the structure seen in bchService.getTransactionHistoryFromElectrum
            const amountBCH = tx.amountBCH || 0; // Amount might be positive for received, 0 for sent in current service
            const amountBRL = amountBCH * rate;
            const type = tx.type || 'unknown'; // 'received', 'sent', 'unknown'
            const feeBCH = tx.feeSatoshis ? tx.feeSatoshis / SATOSHIS_PER_BCH : undefined;

            // Determine recipient/sender address (simplistic)
            let displayAddress = tx.displayAddressValue || tx.address || 'N/A';
            if (type === 'sent' && displayAddress === user.bchAddress) {
                 // If type is 'sent' but address is own, try to find recipient (needs more detailed tx data)
                 displayAddress = 'Multiple/Unknown'; // Placeholder
            }

            return {
                _id: tx._id || tx.txid, // Use txid as _id
                type: type,
                amountBCH: amountBCH,
                amountBRL: amountBRL,
                address: displayAddress, // Address shown in UI (recipient for sent, own for received)
                txid: tx.txid,
                timestamp: tx.timestamp, // Expecting ISO string from service
                status: tx.status, // 'pending' or 'confirmed'
                confirmations: tx.confirmations || 0,
                blockHeight: tx.blockHeight > 0 ? tx.blockHeight : undefined,
                fee: type === 'sent' ? feeBCH : undefined, // Fee only relevant for sent txs
            };
        });

        // Sort by timestamp descending (most recent first) - service might already do this
        formattedTransactions.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

        res.status(200).json(formattedTransactions);
        logger.info(`[${endpoint}] User ID: ${userId} - Successfully sent ${formattedTransactions.length} transactions.`);

    } catch (error) {
        logger.error(`[${endpoint}] Error fetching transactions for user ${req.user?.id}: ${error.message}`);
        logger.error(error.stack);
        res.status(500).json({ message: error.message || 'Server error fetching transactions' });
    }
};


// --- UPDATED: sendBCH Controller ---
const sendBCH = async (req, res) => {
    const endpoint = '/api/wallet/send (POST)';
    const userId = req.user?.id;
    if (!userId) {
        logger.error(`[${endpoint}] Error: userId not found in req.user.`);
        return res.status(401).json({ message: 'User not identified' });
    }

    // Get address, amount, AND fee from body
    const { address: toAddress, amount: amountBCHString, fee } = req.body;
    logger.info(`[${endpoint}] User ID: ${userId} - Received send request: To=${toAddress}, Amount=${amountBCHString}, FeeLevel=${fee}`);

    // --- Input Validation ---
    if (!toAddress || !amountBCHString || !fee) { // Check fee presence
        logger.warn(`[${endpoint}] User ID: ${userId} - Bad Request: Missing fields (address, amount, or fee).`);
        return res.status(400).json({ message: 'Missing required fields: address, amount, fee' });
    }
    if (!bchService.validateAddress(toAddress)) {
        logger.warn(`[${endpoint}] User ID: ${userId} - Bad Request: Invalid recipient address format: ${toAddress}`);
        return res.status(400).json({ message: 'Endereço de destino inválido.' });
    }
    const amountBCH = parseFloat(amountBCHString);
    if (isNaN(amountBCH) || amountBCH <= 0) {
        logger.warn(`[${endpoint}] User ID: ${userId} - Bad Request: Invalid amount format: ${amountBCHString}`);
        return res.status(400).json({ message: 'Quantidade inválida.' });
    }
    const amountSatoshis = Math.round(amountBCH * SATOSHIS_PER_BCH);
    if (amountSatoshis < DUST_THRESHOLD_SATOSHIS) {
        logger.warn(`[${endpoint}] User ID: ${userId} - Bad Request: Amount ${amountSatoshis} satoshis below dust threshold.`);
        return res.status(400).json({ message: `Quantia inválida: O valor mínimo é ${DUST_THRESHOLD_SATOSHIS} satoshis.` });
    }
    // Validate fee level
    if (!['low', 'medium', 'high'].includes(fee)) {
        logger.warn(`[${endpoint}] User ID: ${userId} - Bad Request: Invalid fee level: ${fee}`);
        return res.status(400).json({ message: 'Invalid fee level. Use low, medium, or high.' });
    }
    // --- End Input Validation ---

    try {
        const user = await User.findById(userId).select('+encryptedMnemonic +encryptedDerivationPath');
        if (!user || !user.encryptedMnemonic || !user.encryptedDerivationPath) {
             logger.error(`[${endpoint}] Error: User ${userId} or wallet data not found.`);
             return res.status(404).json({ message: 'User or wallet data not found.' });
        }

        const encryptionKey = process.env.ENCRYPTION_KEY;
        if (!encryptionKey) {
             logger.error(`[${endpoint}] FATAL: ENCRYPTION_KEY is not set.`);
             throw new Error("Server configuration error: Missing encryption key.");
        }

        logger.info(`[${endpoint}] User ID: ${userId} - Deriving private key...`);
        const fromWif = await bchService.derivePrivateKey(user.encryptedMnemonic, user.encryptedDerivationPath, encryptionKey);

        logger.info(`[${endpoint}] User ID: ${userId} - Calling bchService.sendTransaction with fee level ${fee}...`);

        // *** IMPORTANT: Assumes bchService.sendTransaction is updated to accept feeLevel ***
        // *** If not, bchService needs modification ***
        const txid = await bchService.sendTransaction(fromWif, toAddress, amountBCH, fee); // Pass fee level

        logger.info(`[${endpoint}] User ID: ${userId} - Transaction sent successfully. TXID: ${txid}`);
        res.status(200).json({ txid, message: 'Transação enviada com sucesso!' });

    } catch (error) {
        // --- Error Handling (Keep detailed handling) ---
        logger.error(`[${endpoint}] Error sending BCH for user ${userId}: ${error.message}`);
        logger.error(error.stack);
        let errorMessage = 'Erro interno no servidor ao enviar BCH.';
        let statusCode = 500; // Default status code

        // Map specific errors to user-friendly messages and potentially 4xx status codes
        if (error.message.includes('Saldo insuficiente') || error.message.includes('Insufficient funds')) {
            errorMessage = 'Saldo insuficiente para completar a transação (incluindo taxa).';
            statusCode = 400; // Bad request (insufficient funds)
        } else if (error.message.includes('dust') || (error.message.includes('rejected') && error.message.includes('rules'))) {
            errorMessage = `Erro de rede: A quantia enviada (${amountSatoshis} sat) é muito pequena (abaixo do limite de ${DUST_THRESHOLD_SATOSHIS} sat).`;
            statusCode = 400;
        } else if (error.message.includes('Invalid recipient address') || error.message.includes('Endereço de destino inválido')) {
             errorMessage = 'Endereço de destino inválido.';
             statusCode = 400;
        } else if (error.message.includes('Invalid amount') || error.message.includes('Quantidade inválida')) {
             errorMessage = 'Quantidade inválida.';
             statusCode = 400;
        } else if (error.message.includes('decrypt')) {
            errorMessage = 'Erro ao acessar dados seguros da carteira.';
            statusCode = 500; // Internal server error
        } else if (error.message.includes('derivar chave privada')) {
            errorMessage = 'Erro ao preparar a carteira para envio.';
            statusCode = 500;
        } else if (error.message.includes('Erro ao enviar transação') || error.message.includes('Error sending transaction')) {
            // Use the specific error from the service if available and seems safe
            errorMessage = error.message;
            statusCode = 500; // Or potentially 400/502 depending on the cause
        } else if (error.message.includes('Server configuration error')) {
             errorMessage = 'Erro de configuração no servidor.';
             statusCode = 500;
        }

        res.status(statusCode).json({ message: errorMessage, error: error.message }); // Include original error for debugging if needed
        // --- End Error Handling ---
    }
};

const getTotalSalesToday = async (req, res) => {
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
