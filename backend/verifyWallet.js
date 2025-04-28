// z:\Kashy-Project\backend\verifyWallet.js
require('dotenv').config();
// const axios = require('axios'); // Não precisamos mais do axios
const mongoose = require('mongoose');
const User = require('./src/models/user');
const cryptoUtils = require('./src/utils/cryptoUtils');
const connectDB = require('./src/config/db');
const bchService = require('./src/services/bchService'); // Importar bchService para connectToElectrum
const BCHJS = require('@psf/bch-js'); // Precisamos do bchjs para conversão de endereço

// const BLOCKCHAIR_API = process.env.BLOCKCHAIR_API || 'https://api.blockchair.com/bitcoin-cash'; // Não precisamos mais
const USER_EMAIL_TO_VERIFY = 'new2usesr@testssss.csom'; // <-- CHANGE THIS

async function verify() {
    const encryptionKey = process.env.ENCRYPTION_KEY;
    if (!encryptionKey || encryptionKey.length !== 64) {
        console.error('FATAL: ENCRYPTION_KEY environment variable is missing or not the correct length (should be 32 bytes / 64 hex characters).');
        process.exit(1);
    }

    let user;
    let derivedAddress;
    let electrumClient = null; // Cliente Electrum para reutilização

    try {
        console.log('Connecting to DB...');
        await connectDB();
        console.log('MongoDB Connected.');

        console.log(`Finding user: ${USER_EMAIL_TO_VERIFY}...`);
        user = await User.findOne({ email: USER_EMAIL_TO_VERIFY });

        if (!user) {
            console.error(`User not found: ${USER_EMAIL_TO_VERIFY}`);
            return;
        }
        if (!user.encryptedMnemonic || !user.encryptedDerivationPath) {
            console.error(`User ${USER_EMAIL_TO_VERIFY} is missing encrypted wallet data.`);
            return;
        }

        console.log('Decrypting mnemonic and path...');
        const mnemonic = cryptoUtils.decrypt(user.encryptedMnemonic, encryptionKey);
        const derivationPath = cryptoUtils.decrypt(user.encryptedDerivationPath, encryptionKey);

        console.log('------------------------------------');
        // console.log('Decrypted Mnemonic:', mnemonic); // SECURITY RISK: Don't log this in production!
        console.log('Decrypted Path:', derivationPath);
        console.log('Stored Address:', user.bchAddress);
        console.log('------------------------------------');

        console.log('Deriving address from decrypted mnemonic...');
        const network = process.env.BCH_NETWORK === 'testnet' ? 'testnet' : 'mainnet';
        const bchjs = new BCHJS({ restURL: network === 'testnet' ? process.env.BCH_TESTNET_API : process.env.BCH_MAINNET_API });

        const rootSeedBuffer = await bchjs.Mnemonic.toSeed(mnemonic);
        const masterHDNode = bchjs.HDNode.fromSeed(rootSeedBuffer, network);
        const childNode = masterHDNode.derivePath(derivationPath);
        derivedAddress = bchjs.HDNode.toCashAddress(childNode);
        console.log('Derived Address:', derivedAddress);

        if (user.bchAddress && derivedAddress === user.bchAddress) {
            console.log('✅ SUCCESS: Derived address matches the stored address.');
        } else if (!user.bchAddress) {
            console.warn(`⚠️ INFO: Stored address was missing. Derived address is ${derivedAddress}.`);
        } else {
            console.error('❌ FAILURE: Derived address DOES NOT match the stored address!');
            console.error(`   Stored:  ${user.bchAddress}`);
            console.error(`   Derived: ${derivedAddress}`);
        }

        const isValidFormat = bchjs.Address.isCashAddress(derivedAddress);
        if (isValidFormat) {
            console.log(`✅ SUCCESS: Derived address (${derivedAddress}) has a valid BCH format.`);
        } else {
            console.error(`❌ FAILURE: Derived address (${derivedAddress}) has an INVALID BCH format.`);
        }

        // --- Verification Step 3: Check balance and transactions using Electrum ---
        try {
            console.log(`Fetching balance and history for ${derivedAddress} using Electrum...`);
            electrumClient = await bchService.connectToElectrum(); // Usar a função de conexão do bchService

            // Calcular script hash
            const scriptPubKey = bchjs.Address.toOutputScript(derivedAddress);
            const scriptHashBuffer = require('crypto').createHash('sha256').update(scriptPubKey).digest();
            const scriptHash = Buffer.from(scriptHashBuffer.reverse()).toString('hex');

            // Obter saldo
            const balanceResult = await electrumClient.request('blockchain.scripthash.get_balance', [scriptHash]);
            const confirmed = (balanceResult?.confirmed || 0) / 1e8;
            const unconfirmed = (balanceResult?.unconfirmed || 0) / 1e8;
            console.log(`✅ SUCCESS: Balance check successful. Balance: ${confirmed} BCH (Unconfirmed: ${unconfirmed} BCH)`);

            // Obter histórico
            const history = await electrumClient.request('blockchain.scripthash.get_history', [scriptHash]);
            console.log(`Transactions History (${history?.length || 0} items):`);
            (history || []).forEach((tx, index) => {
                console.log(`${index + 1}. TX Hash: ${tx.tx_hash}, Height: ${tx.height}`);
            });

        } catch (electrumError) {
            console.error(`❌ FAILURE: Error fetching balance/history via Electrum for derived address: ${electrumError.message}`);
        }
        // --- End Verification Step 3 ---


        if (user && !user.bchAddress && derivedAddress && isValidFormat) {
            try {
                console.log('Updating user document with derived address...');
                user.bchAddress = derivedAddress;
                await user.save();
                console.log('User document updated successfully.');
            } catch (updateError) {
                console.error('❌ FAILURE: Error updating user document with derived address:', updateError);
            }
        }

    } catch (error) {
        console.error('An error occurred during verification:', error);
    } finally {
        if (electrumClient) {
            try {
                await electrumClient.close();
                console.log('Electrum connection closed.');
            } catch (closeErr) {
                console.error('Error closing Electrum connection:', closeErr);
            }
        }
        console.log('Disconnecting from DB...');
        await mongoose.disconnect();
        console.log('Disconnected.');
    }
}

verify();
