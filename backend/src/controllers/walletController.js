// src/controllers/walletController.js
const User = require('../models/user');
const Transaction = require('../models/transaction'); // <-- Import the Transaction model
// const bchService = require('../services/bchService'); // Keep if needed for other things (like sending)
// const spvMonitorService = require('../services/spvMonitorService'); // No longer needed for getBalance/getTransactions

const getWalletData = async (req, res) => {
    try {
        const userId = req.user.id;
        const user = await User.findById(userId);

        if (!user) {
            return res.status(404).json({ message: 'Usuário não encontrado.' });
        }

        const balanceSatoshis = user.balance || 0;

        const userTransactions = await Transaction.find({ userId: userId })
            .sort({ timestamp: -1 })
            .limit(50);

            const transactions = userTransactions.map(tx => ({
                txid: tx.txid,
                type: tx.type,
                amountSatoshis: tx.amountSatoshis,
                amountBCH: tx.amountSatoshis / 1e8,
                timestamp: tx.timestamp,
                blockHeight: tx.blockHeight,
                fromAddress: tx.fromAddress || 'N/A', // Certifique-se de incluir o fromAddress
                toAddress: tx.toAddress,
              }));

        const walletData = {
            balance: {
                totalSatoshis: balanceSatoshis,
                totalBCH: balanceSatoshis / 1e8,
                totalBRL: (balanceSatoshis / 1e8) * 3500, // Exemplo de taxa BRL
            },
            transactions,
            address: user.bchAddress,
        };

        res.status(200).json(walletData);
    } catch (error) {
        console.error('Erro ao obter dados da carteira:', error);
        res.status(500).json({ message: 'Erro ao obter dados da carteira.', error: error.message });
    }
};

module.exports = { getWalletData };
