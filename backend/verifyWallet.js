require('dotenv').config();
const axios = require('axios');
const mongoose = require('mongoose');
const User = require('./src/models/user'); 
const cryptoUtils = require('./src/utils/cryptoUtils'); 
const connectDB = require('./src/config/db'); 

const BLOCKCHAIR_API = process.env.BLOCKCHAIR_API || 'https://api.blockchair.com/bitcoin-cash';
const USER_EMAIL_TO_VERIFY = 'new2usesr@testssss.csom'; // <-- CHANGE THIS to the user you want to check

async function verify() {
    const encryptionKey = process.env.ENCRYPTION_KEY;
    if (!encryptionKey || encryptionKey.length !== 64) { // Check if key is hex and 32 bytes (64 hex chars)
        console.error('FATAL: ENCRYPTION_KEY environment variable is missing or not the correct length (should be 32 bytes / 64 hex characters).');
        process.exit(1);
    }

    let user; // Declare user in a higher scope
    let derivedAddress; // Declare derivedAddress in a higher scope

    try {
        console.log('Connecting to DB...');
        await connectDB();
        console.log('MongoDB Connected.');

        console.log(`Finding user: ${USER_EMAIL_TO_VERIFY}...`);
        user = await User.findOne({ email: USER_EMAIL_TO_VERIFY });

        if (!user) {
            console.error(`User not found: ${USER_EMAIL_TO_VERIFY}`);
            return; // Exit if user not found
        }

        if (!user.encryptedMnemonic || !user.encryptedDerivationPath) {
            console.error(`User ${USER_EMAIL_TO_VERIFY} is missing encrypted wallet data.`);
            return; // Exit if essential data is missing
        }

        console.log('Decrypting mnemonic and path...');
        const mnemonic = cryptoUtils.decrypt(user.encryptedMnemonic, encryptionKey);
        const derivationPath = cryptoUtils.decrypt(user.encryptedDerivationPath, encryptionKey);

        console.log('------------------------------------');
        console.log('Decrypted Mnemonic:', mnemonic); // SECURITY RISK: Don't log this in production!
        console.log('Decrypted Path:', derivationPath);
        console.log('Stored Address:', user.bchAddress); // Will be undefined if not saved previously
        console.log('------------------------------------');

        console.log('Deriving address from decrypted mnemonic...');
        const network = process.env.BCH_NETWORK === 'testnet' ? 'testnet' : 'mainnet';

        // Create an instance of BCHJS
        const BCHJS = require('@psf/bch-js');
        const bchjs = new BCHJS({ restURL: network === 'testnet' ? process.env.BCH_TESTNET_API : process.env.BCH_MAINNET_API });

        // Use the instance to call methods
        const rootSeedBuffer = await bchjs.Mnemonic.toSeed(mnemonic);
        const masterHDNode = bchjs.HDNode.fromSeed(rootSeedBuffer, network);
        const childNode = masterHDNode.derivePath(derivationPath);
        derivedAddress = bchjs.HDNode.toCashAddress(childNode);

        console.log('Derived Address:', derivedAddress);

        // Verification Step 1: Compare derived address with stored address
        if (user.bchAddress && derivedAddress === user.bchAddress) {
            console.log('✅ SUCCESS: Derived address matches the stored address.');
        } else if (!user.bchAddress) {
            console.warn(`⚠️ INFO: Stored address was missing. Derived address is ${derivedAddress}.`);
        } else {
            console.error('❌ FAILURE: Derived address DOES NOT match the stored address!');
            console.error(`   Stored:  ${user.bchAddress}`);
            console.error(`   Derived: ${derivedAddress}`);
        }

        // Verification Step 2: Validate address format
        const isValidFormat = bchjs.Address.isCashAddress(derivedAddress);
        if (isValidFormat) {
            console.log(`✅ SUCCESS: Derived address (${derivedAddress}) has a valid BCH format.`);
        } else {
            console.error(`❌ FAILURE: Derived address (${derivedAddress}) has an INVALID BCH format.`);
        }

        // Verification Step 3: Check balance and transactions using Blockchair API
        try {
            console.log(`Fetching balance and transactions for ${derivedAddress} using Blockchair API...`);
            const response = await axios.get(`${BLOCKCHAIR_API}/dashboards/address/${derivedAddress}`);
            const addressData = response.data.data[derivedAddress].address;
            const transactions = response.data.data[derivedAddress].transactions;

            const confirmed = addressData.balance ; // Convert satoshis to BCH
            const unconfirmed = addressData.unconfirmed_balance / 1e8; // Convert satoshis to BCH

            console.log(`✅ SUCCESS: Balance check successful. Balance: ${confirmed} BCH (Unconfirmed: ${unconfirmed} BCH)`);

            console.log('Transactions:');
            transactions.forEach((tx, index) => {
                console.log(`${index + 1}. Transaction ID: ${tx}`);
            });
        } catch (balanceError) {
            console.error(`❌ FAILURE: Error fetching balance and transactions for derived address: ${balanceError.message}`);
        }

        // Update user document if bchAddress was missing
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
        console.log('Disconnecting from DB...');
        await mongoose.disconnect();
        console.log('Disconnected.');
    }
}

// Execute the verification function
verify();