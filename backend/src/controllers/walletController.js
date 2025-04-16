// src/controllers/walletController.js
const User = require('../models/user');
const Transaction = require('../models/transaction'); // <-- Import the Transaction model
// const bchService = require('../services/bchService'); // Keep if needed for other things (like sending)
// const spvMonitorService = require('../services/spvMonitorService'); // No longer needed for getBalance/getTransactions

const getWalletData = async (req, res) => {
    try {
        const userId = req.user.id; // Get user ID from authenticated token payload
        const user = await User.findById(userId);

        if (!user) {
            return res.status(404).json({ message: 'Usuário não encontrado.' });
        }

        // --- Get Balance from User Model ---
        const balanceSatoshis = user.balance || 0;

        // --- Get Transactions from Database ---
        const userTransactions = await Transaction.find({ userId: userId })
            .sort({ timestamp: -1 }) // Sort by most recent first
            .limit(50); // Limit to the latest 50 transactions (or implement pagination)

        // --- Prepare Response Data ---
        const SATOSHIS_PER_BCH = 100000000;
        // WARNING: Hardcoding BRL rate is bad practice. Use a real-time API in production.
        const BRL_PER_BCH_EXAMPLE = 3500; // Example rate

        const walletData = {
            balance: {
                totalSatoshis: balanceSatoshis,
                totalBCH: balanceSatoshis / SATOSHIS_PER_BCH,
                totalBRL: (balanceSatoshis / SATOSHIS_PER_BCH) * BRL_PER_BCH_EXAMPLE,
                // Add confirmed/unconfirmed if you store them separately on the User model
            },
            // Map transactions to a cleaner format if desired, or send as is
            transactions: userTransactions.map(tx => ({
                txid: tx.txid,
                type: tx.type,
                amountSatoshis: tx.amountSatoshis,
                amountBCH: tx.amountSatoshis / SATOSHIS_PER_BCH,
                timestamp: tx.timestamp,
                blockHeight: tx.blockHeight,
                // Add other fields from the Transaction model if needed
            })),
            address: user.bchAddress,
        };

        res.status(200).json(walletData);

    } catch (error) {
        console.error('Erro ao obter dados da carteira:', error);
        res.status(500).json({ message: 'Erro ao obter dados da carteira.', error: error.message });
    }
};

module.exports = { getWalletData };
