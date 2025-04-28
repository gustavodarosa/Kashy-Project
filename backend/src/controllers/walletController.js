// z:\Kashy-Project\backend\src\controllers\walletController.js
const User = require('../models/user');
// Remove Transaction model import
// const Transaction = require('../models/transaction');
const bchService = require('../services/bchService');
const cryptoUtils = require('../utils/cryptoUtils'); // Keep if needed elsewhere, maybe not here
const logger = require('../utils/logger');

const SATOSHIS_PER_BCH = 1e8;
const DUST_THRESHOLD_SATOSHIS = 546; // Keep for send validation

/**
 * Helper function to format addresses for display.
 */
function formatAddress(address) {
    if (!address || typeof address !== 'string') return 'Endereço Inválido';
    if (address.includes(':') && address.length > 20) {
        const parts = address.split(':'); const addrPart = parts[1];
        if (addrPart && addrPart.length > 15) return `${parts[0]}:${addrPart.substring(0, 10)}...${addrPart.substring(addrPart.length - 5)}`;
    }
    if (address.length > 20) return `${address.substring(0, 10)}...${address.substring(address.length - 5)}`;
    return address;
}

/**
 * Fetches wallet balance and address from DB, and transaction history LIVE from Electrum.
 */
const getWalletData = async (req, res) => {
    const endpoint = '/api/wallet (GET)';
    try {
        // 1. Get userId
        const userId = req.user?.id;
        if (!userId) {
            logger.error(`[${endpoint}] Error: userId not found in req.user.`);
            return res.status(401).json({ message: 'Authentication failed or user ID not found.' });
        }
        logger.info(`[${endpoint}] User ID: ${userId} - Fetching wallet data.`);

        // 2. Find user (fetching balance and address)
        const user = await User.findById(userId).select('bchAddress balance');
        if (!user) {
            logger.error(`[${endpoint}] Error: User not found with ID: ${userId}`);
            return res.status(404).json({ message: 'User not found.' });
        }

        // --- MODIFICATION START ---
        // 3. Fetch user transactions LIVE from bchService
        logger.info(`[${endpoint}] User ID: ${userId} - Fetching live transactions from Electrum for ${user.bchAddress}...`);
        let transactions = []; // Default to empty array
        try {
            // Call the new service function
            transactions = await bchService.getTransactionHistoryFromElectrum(user.bchAddress, 50); // Limit to 50
            logger.info(`[${endpoint}] User ID: ${userId} - Found ${transactions.length} live transactions.`);
        } catch (txFetchError) {
            logger.error(`[${endpoint}] User ID: ${userId} - Failed to fetch live transactions: ${txFetchError.message}`);
            // Log the error, but return empty transactions array to the client
            // The frontend should handle the display of an empty list or show an error message.
        }
        // --- MODIFICATION END ---

        // 4. Prepare balance data (using user.balance for confirmed)
        const confirmedSatoshis = user.balance || 0;
        const balanceData = {
            confirmedBCH: confirmedSatoshis / SATOSHIS_PER_BCH,
            unconfirmedBCH: 0, // Unconfirmed comes via WebSocket
            totalBCH: confirmedSatoshis / SATOSHIS_PER_BCH
        };
        logger.info(`[${endpoint}] User ID: ${userId} - Calculated balance from DB: ${JSON.stringify(balanceData)}`);

        // 5. Construct final response object
        const walletData = {
            balance: balanceData,
            transactions: transactions, // Use the live-fetched transactions
            address: user.bchAddress,
        };

        res.status(200).json(walletData);
        logger.info(`[${endpoint}] User ID: ${userId} - Successfully sent wallet data.`);

    } catch (error) {
        logger.error(`[${endpoint}] Error fetching wallet data for user ${req.user?.id}: ${error.message}`);
        logger.error(error.stack);
        res.status(500).json({ message: 'Erro interno no servidor ao obter dados da carteira.', error: error.message });
    }
};

// --- sendBCH function remains the same ---
const sendBCH = async (req, res) => {
    const endpoint = '/api/wallet/send (POST)';
    const userId = req.user?.id;
    if (!userId) { /* ... auth check ... */ }
    const { address: toAddress, amount: amountBCHString } = req.body;
    logger.info(`[${endpoint}] User ID: ${userId} - Received send request: To=${toAddress}, Amount=${amountBCHString}`);
    // --- Input Validation ---
    if (!toAddress || !amountBCHString) { /* ... missing fields check ... */ }
    if (!bchService.validateAddress(toAddress)) { /* ... address format check ... */ }
    const amountBCH = parseFloat(amountBCHString);
    if (isNaN(amountBCH) || amountBCH <= 0) { /* ... invalid amount format check ... */ }
    const amountSatoshis = Math.round(amountBCH * SATOSHIS_PER_BCH);
    if (amountSatoshis < DUST_THRESHOLD_SATOSHIS) { // Dust check
        logger.warn(`[${endpoint}] User ID: ${userId} - Bad Request: Amount ${amountSatoshis} satoshis below dust threshold.`);
        return res.status(400).json({ message: `Quantia inválida: O valor mínimo é ${DUST_THRESHOLD_SATOSHIS} satoshis.` });
    }
    // --- End Input Validation ---
    try {
        const user = await User.findById(userId).select('+encryptedMnemonic +encryptedDerivationPath');
        if (!user || !user.encryptedMnemonic || !user.encryptedDerivationPath) { /* ... user/data check ... */ }
        const encryptionKey = process.env.ENCRYPTION_KEY;
        if (!encryptionKey) { /* ... key check ... */ }
        logger.info(`[${endpoint}] User ID: ${userId} - Deriving private key...`);
        const fromWif = await bchService.derivePrivateKey(user.encryptedMnemonic, user.encryptedDerivationPath, encryptionKey);
        logger.info(`[${endpoint}] User ID: ${userId} - Calling bchService.sendTransaction...`);
        const txid = await bchService.sendTransaction(fromWif, toAddress, amountBCH); // Use the primary send function
        logger.info(`[${endpoint}] User ID: ${userId} - Transaction sent successfully. TXID: ${txid}`);
        res.status(200).json({ txid, message: 'Transação enviada com sucesso!' });
    } catch (error) {
        // --- Error Handling (Keep detailed handling) ---
        logger.error(`[${endpoint}] Error sending BCH for user ${userId}: ${error.message}`);
        logger.error(error.stack);
        let errorMessage = 'Erro interno no servidor ao enviar BCH.';
        if (error.message.includes('Saldo insuficiente') || error.message.includes('Insufficient funds')) { errorMessage = 'Saldo insuficiente para completar a transação.'; }
        else if (error.message.includes('dust') || (error.message.includes('rejected') && error.message.includes('rules'))) { errorMessage = `Erro de rede: A quantia enviada (${amountSatoshis} sat) é muito pequena (abaixo do limite de ${DUST_THRESHOLD_SATOSHIS} sat).`; }
        else if (error.message.includes('decrypt')) { errorMessage = 'Erro ao acessar dados seguros da carteira.'; }
        else if (error.message.includes('derivar chave privada')) { errorMessage = 'Erro ao preparar a carteira para envio.'; }
        else if (error.message.includes('Endereço de destino inválido')) { errorMessage = error.message; }
        else if (error.message.includes('Erro ao enviar transação')) { errorMessage = error.message; }
        res.status(500).json({ message: errorMessage, error: error.message });
        // --- End Error Handling ---
    }
};

// --- Module Exports ---
module.exports = {
    getWalletData,
    sendBCH
};
