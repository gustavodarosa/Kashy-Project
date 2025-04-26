const User = require('../models/user'); 
const Transaction = require('../models/transaction'); 
const bchService = require('../services/bchService'); 
const { derivePrivateKey } = require('../services/bchService');
const cryptoUtils = require('../utils/cryptoUtils');

const getWalletData = async (req, res) => {
    try {
        // --- FIX 1: Get userId from the authenticated user ---
        const userId = req.user?.id; // Assumes authMiddleware adds user object with id to req.user

        // --- FIX 2: Add check if userId exists (authentication failed?) ---
        if (!userId) {
            console.error('WalletController Error: userId not found in req.user. Authentication might have failed.');
            return res.status(401).json({ message: 'Authentication failed or user ID not found.' });
        }

        // --- FIX 3: Find the user document ---
        const user = await User.findById(userId);
        if (!user) {
            console.error(`WalletController Error: User not found with ID: ${userId}`);
            return res.status(404).json({ message: 'User not found.' });
        }

        // --- Now use the validated userId ---
        const userTransactions = await Transaction.find({ userId: userId })
            .sort({ timestamp: -1 })
            .limit(50); // Limit the number of transactions fetched

        // --- Transaction Mapping (Your existing logic) ---
        const transactions = userTransactions.map(tx => {
            let displayAddressField;
            let displayAddressLabel;

            if (tx.type === 'incoming') {
                 displayAddressField = tx.fromAddress ? formatAddress(tx.fromAddress) : 'Origem Desconhecida';
                 displayAddressLabel = 'Recebido de';
            } else if (tx.type === 'outgoing') {
                 displayAddressField = tx.toAddress ? formatAddress(tx.toAddress) : 'Destino Desconhecido';
                 displayAddressLabel = 'Enviado para';
            } else { // internal or other types
                 displayAddressField = tx.address ? formatAddress(tx.address) : 'Endereço Interno';
                 displayAddressLabel = 'Movimentação Interna para';
            }

            return {
                txid: tx.txid,
                type: tx.type === 'incoming' ? 'received' : (tx.type === 'outgoing' ? 'sent' : 'internal'),
                amountSatoshis: tx.amountSatoshis,
                amountBCH: tx.amountSatoshis / 1e8,
                fromAddress: tx.fromAddress,
                toAddress: tx.toAddress,
                address: tx.address,
                displayAddressLabel: displayAddressLabel,
                displayAddressValue: displayAddressField,
                timestamp: tx.timestamp,
                status: tx.blockHeight > 0 ? 'confirmed' : 'pending',
            };
        });
        // --- END Transaction Mapping ---

        // --- FIX 4: Calculate balance using the fetched user object ---
        // Assuming user.balance stores the total balance in satoshis updated by SPV
        const balanceData = {
            confirmedBCH: (user.balance || 0) / 1e8, // Use user.balance
            unconfirmedBCH: 0, // SPV service updates the main balance field, so unconfirmed might be implicitly included or not tracked separately here. Adjust if needed.
            totalBCH: (user.balance || 0) / 1e8
        };

        // --- Construct final response ---
        const walletData = {
            balance: balanceData, // Use the calculated balance
            transactions,
            address: user.bchAddress, // Use the address from the fetched user object
        };

        res.status(200).json(walletData);

    } catch (error) {
        // Log the detailed error on the backend
        console.error('Erro ao obter dados da carteira:', error);
        // Send a generic error message to the frontend
        res.status(500).json({ message: 'Erro ao obter dados da carteira.', error: error.message });
    }
};

// Helper function (Keep this or import it)
function formatAddress(address) {
    if (!address || typeof address !== 'string') return '';
    // Simple formatting, adjust as needed
    if (address.length > 20) {
        return `${address.substring(0, 10)}...${address.substring(address.length - 5)}`;
    }
    return address;
}

/**
 * Envia BCH de uma carteira para outra.
 * @param {object} req - Requisição HTTP.
 * @param {object} res - Resposta HTTP.
 */
const sendBCH = async (req, res) => {
  try {
    const { address, amount } = req.body;
    const userId = req.user.id;

    console.log('Dados recebidos no backend:', { address, amount, userId });

    if (!address || !amount) {
      return res.status(400).json({ message: 'Endereço e quantia são obrigatórios.' });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'Usuário não encontrado.' });
    }

    const encryptionKey = process.env.ENCRYPTION_KEY;
    console.log('Chave de criptografia carregada:', encryptionKey);

    // Log encrypted data
    console.log('Encrypted Mnemonic:', user.encryptedMnemonic);
    console.log('Encrypted Derivation Path:', user.encryptedDerivationPath);

    // Attempt decryption
    const mnemonic = cryptoUtils.decrypt(user.encryptedMnemonic, encryptionKey);
    const derivationPath = cryptoUtils.decrypt(user.encryptedDerivationPath, encryptionKey);

    console.log('Mnemônico descriptografado:', mnemonic);
    console.log('Caminho de derivação descriptografado:', derivationPath);

    const fromWif = await derivePrivateKey(user.encryptedMnemonic, user.encryptedDerivationPath, encryptionKey);
    console.log('Chave privada derivada:', fromWif);

    const txid = await bchService.sendTransaction(fromWif, address, parseFloat(amount));
    console.log('Transação enviada com sucesso. TXID:', txid);

    res.status(200).json({ txid, message: 'Transação enviada com sucesso!' });
  } catch (error) {
    console.error('Erro ao enviar BCH:', error);
    res.status(500).json({ message: 'Erro ao enviar BCH.', error: error.message });
  }
};

module.exports = { getWalletData, sendBCH };
