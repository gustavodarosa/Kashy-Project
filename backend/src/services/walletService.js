// z:\Kashy-Project\backend\src\services\walletService.js

// Use CommonJS require syntax
const { Wallet } = require('mainnet-js'); // Only need Wallet for derivation/signing potentially
const bitcore = require('bitcore-lib-cash');
const config = require('../config');
const { getBchToBrlRate } = require('./exchangeRate');
const logger = require('../utils/logger');
// Import the new request manager
const electrumRequestManager = require('./electrumRequestManager');
// Import crypto utils if needed for key derivation (as getUserWallet uses it)
const cryptoUtils = require('../utils/cryptoUtils');
// Import bchjs for transaction building if not using mainnet-js Wallet for it
const BCHJS = require('@psf/bch-js'); // Keep bchjs for building/signing

const SATOSHIS_PER_BCH = 100_000_000;
const DUST_THRESHOLD = 546; // Dust threshold in satoshis

// --- REMOVE mainnet-js ElectrumNetworkProvider ---
// const provider = new ElectrumNetworkProvider(...)

// --- Initialize bch-js ---
const bchjsOptions = {};
if (config.network === 'testnet' && process.env.BCH_TESTNET_API) {
    bchjsOptions.restURL = process.env.BCH_TESTNET_API;
} else if (config.network === 'mainnet' && process.env.BCH_MAINNET_API) {
    bchjsOptions.restURL = process.env.BCH_MAINNET_API;
} else {
    bchjsOptions.restURL = 'https://api.mainnet.cash'; // Default if not set
}
const bchjs = new BCHJS(bchjsOptions);

// --- Wallet Derivation/Loading (Modified) ---
// Keep getUserWallet for deriving keys, but don't attach provider
async function getUserWalletKeys(userId) {
    // This function now primarily returns keys/address, not a full mainnet-js Wallet object
    // TODO: Replace with your actual secure key management logic
    const userWif = config.exampleUserWif; // Load from config/env for demo
    if (!userWif) {
        logger.error(`User WIF not configured for demo user ID: ${userId}`);
        throw new Error('User WIF not configured for demo');
    }

    try {
        // Use bchjs directly for keypair and address from WIF
        const keyPair = bchjs.ECPair.fromWIF(userWif);
        const address = bchjs.ECPair.toCashAddress(keyPair);

        logger.info(`Derived keys/address for user ${userId} with address prefix ${address?.substring(0, 15)}...`);
        return {
            wif: userWif,
            keyPair: keyPair, // bchjs keypair
            address: address, // cashaddr
        };
    } catch (error) {
        logger.error(`Failed to derive keys for user ${userId}: ${error.message}`);
        throw new Error(`Failed to initialize wallet keys: ${error.message}`);
    }
}

// --- Helper: Address to ScriptHash ---
// (Could move to a utility file)
const crypto = require('crypto');
const cashaddr = require('cashaddrjs');

function addressToScriptHash(address) {
    try {
        const { type, hash } = cashaddr.decode(address);
        let script;
        if (type === 'P2PKH') {
            script = Buffer.concat([ Buffer.from([0x76]), Buffer.from([0xa9]), Buffer.from([hash.length]), hash, Buffer.from([0x88]), Buffer.from([0xac]) ]);
        } else if (type === 'P2SH') { // Handle P2SH if needed
             script = Buffer.concat([ Buffer.from([0xa9]), Buffer.from([hash.length]), hash, Buffer.from([0x87]) ]);
        } else { throw new Error(`Unsupported address type: ${type}`); }

        const scriptHashBuffer = crypto.createHash('sha256').update(script).digest();
        return Buffer.from(scriptHashBuffer.reverse()).toString('hex');
    } catch (e) {
        logger.error(`Error converting address ${address} to script hash: ${e.message}`);
        throw e;
    }
}


// --- Service Functions (Rewritten for Racing) ---

async function getWalletAddress(userId) {
    // This function might not even need electrum, just key derivation
    const keys = await getUserWalletKeys(userId);
    return keys.address;
}

async function getWalletBalance(userId) {
    const keys = await getUserWalletKeys(userId);
    const scriptHash = addressToScriptHash(keys.address);
    const rate = await getBchToBrlRate();

    try {
        // Race the request across connected clients
        const balanceResult = await electrumRequestManager.raceRequest(
            'blockchain.scripthash.get_balance',
            [scriptHash]
        );

        // Parse the result from the fastest client
        const confirmedSatoshis = balanceResult?.confirmed || 0;
        const unconfirmedSatoshis = balanceResult?.unconfirmed || 0;
        const totalSatoshis = confirmedSatoshis + unconfirmedSatoshis;

        const availableBCH = confirmedSatoshis / SATOSHIS_PER_BCH;
        const pendingBCH = unconfirmedSatoshis / SATOSHIS_PER_BCH;
        const totalBCH = totalSatoshis / SATOSHIS_PER_BCH;
        const totalBRL = totalBCH * rate;

        return {
            totalBCH,
            availableBCH,
            pendingBCH,
            totalBRL,
            totalSatoshis,
            currentRateBRL: rate,
        };
    } catch (error) {
        logger.error(`Error fetching balance via racing for user ${userId}: ${error.message}`);
        throw new Error(`Failed to fetch wallet balance: ${error.message}`);
    }
}

async function getBlockHeight() {
    try {
        // Race request for block header/height
        // blockchain.headers.subscribe returns the current header including height
        const headerResult = await electrumRequestManager.raceRequest(
            'blockchain.headers.subscribe',
            [] // No params needed
        );
        return headerResult?.height || 0;
    } catch (error) {
        logger.error(`Failed to get block height via racing: ${error.message}`);
        return 0; // Return 0 or throw, depending on how critical height is
    }
}

async function getWalletTransactions(userId /*, page, limit */) {
    const keys = await getUserWalletKeys(userId);
    const userAddress = keys.address;
    const scriptHash = addressToScriptHash(userAddress);
    const rate = await getBchToBrlRate();
    const currentHeight = await getBlockHeight(); // Fetch height using racing

    try {
        // Race request for history
        const history = await electrumRequestManager.raceRequest(
            'blockchain.scripthash.get_history',
            [scriptHash]
        );

        if (!history || history.length === 0) {
            return [];
        }

        const processedTxs = [];
        // Fetch details - consider if racing is needed here too, or if one server is enough
        // For simplicity, let's race details too, but be mindful of potential rate limits
        const detailPromises = history.map(item =>
            electrumRequestManager.raceRequest('blockchain.transaction.get', [item.tx_hash, true])
                .catch(err => {
                    logger.error(`Failed fetching details for ${item.tx_hash} via racing: ${err.message}`);
                    return null; // Allow Promise.all to continue
                })
        );
        const transactionDetailsList = await Promise.all(detailPromises);

        // Process history using details (similar logic as before, adapted)
        history.forEach((item, index) => {
            const txDetails = transactionDetailsList[index];
            if (!txDetails) return; // Skip if detail fetch failed

            const txid = item.tx_hash;
            const blockHeight = item.height > 0 ? item.height : undefined;
            const confirmations = blockHeight && currentHeight > 0 ? currentHeight - blockHeight + 1 : 0;
            const status = confirmations > 0 ? 'confirmed' : 'pending';
            const timestamp = txDetails.blocktime ? new Date(txDetails.blocktime * 1000).toISOString() : new Date().toISOString(); // Use detail's blocktime

            let netSatoshis = 0;
            let feeSatoshis = txDetails.fee ? Math.round(txDetails.fee * SATOSHIS_PER_BCH) : 0;
            let recipientAddress = 'N/A'; // Default if sent
            let isSender = false;

            // Calculate input value from user's address
            let totalInputFromUser = 0;
            for (const vin of txDetails.vin) {
                // Need previous tx details to know the address of the input being spent
                // This simple history doesn't provide enough info easily.
                // We rely on outputs to determine received/sent.
            }

            // Calculate output value to user's address and others
            let totalOutputToUser = 0;
            let firstOtherRecipient = null;
            for (const vout of txDetails.vout) {
                const outputValueSat = vout.valueSat ?? Math.round((vout.value || 0) * SATOSHIS_PER_BCH);
                if (vout.scriptPubKey?.addresses?.includes(userAddress)) {
                    totalOutputToUser += outputValueSat;
                } else if (!firstOtherRecipient && vout.scriptPubKey?.addresses?.[0]) {
                    firstOtherRecipient = vout.scriptPubKey.addresses[0];
                }
            }

            // Determine type based on outputs (simplistic)
            // This needs refinement - mainnet-js's `wallet.getHistory()` likely does better analysis
            let type = 'unknown';
            let amountSatoshis = 0;

            if (totalOutputToUser > 0) {
                 // Could be received OR change from a sent tx. Hard to distinguish without input info.
                 // Let's assume if *only* outputs to user, it's received/consolidation.
                 // If outputs to user AND others, assume it's change from a sent tx.
                 if (firstOtherRecipient) {
                     type = 'sent';
                     recipientAddress = firstOtherRecipient;
                     // Amount sent is harder to calculate without input values.
                     // Let's estimate amount sent = total outputs - output to user (change)
                     const totalOutputSat = txDetails.vout.reduce((sum, vout) => sum + (vout.valueSat ?? Math.round((vout.value || 0) * SATOSHIS_PER_BCH)), 0);
                     amountSatoshis = totalOutputSat - totalOutputToUser; // Amount sent to others
                 } else {
                     type = 'received';
                     recipientAddress = userAddress;
                     amountSatoshis = totalOutputToUser; // Amount received
                 }

            } else if (firstOtherRecipient) {
                 // No output to user, must be sending from the address
                 type = 'sent';
                 recipientAddress = firstOtherRecipient;
                 // Estimate amount = total outputs
                 amountSatoshis = txDetails.vout.reduce((sum, vout) => sum + (vout.valueSat ?? Math.round((vout.value || 0) * SATOSHIS_PER_BCH)), 0);
            }

            // Fallback/Refinement needed - this logic is complex without full UTXO tracking like mainnet-js Wallet does.
            // Consider using a library function if this becomes too unreliable.

            if (amountSatoshis < 0) amountSatoshis = 0; // Safety check

            const amountBCH = amountSatoshis / SATOSHIS_PER_BCH;
            const amountBRL = amountBCH * rate;
            const feeBCH = feeSatoshis / SATOSHIS_PER_BCH;

            processedTxs.push({
                _id: txid, type, amountBCH, amountBRL,
                address: recipientAddress, // Best guess recipient/sender
                txid, timestamp, status, confirmations, blockHeight,
                fee: type === 'sent' ? feeBCH : undefined,
            });
        });

        processedTxs.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
        return processedTxs;

    } catch (error) {
        logger.error(`Error fetching transaction history via racing for user ${userId}: ${error.message}`);
        throw new Error(`Failed to fetch transaction history: ${error.message}`);
    }
}

async function sendTransaction(userId, recipientAddress, amountBchStr, feeLevel) {
    const keys = await getUserWalletKeys(userId);
    const fromAddress = keys.address;
    const wif = keys.wif;
    const amountBCH = parseFloat(amountBchStr);

    // --- Input Validation ---
    if (isNaN(amountBCH) || amountBCH <= 0) { throw new Error('Invalid amount specified.'); }
    // Use bitcore for validation as bchjs validation might be less robust sometimes
    if (!bitcore.Address.isValid(recipientAddress, config.network)) { throw new Error('Invalid recipient address.'); }
    const amountSatoshis = Math.round(amountBCH * SATOSHIS_PER_BCH);
    if (amountSatoshis < DUST_THRESHOLD) { throw new Error(`Amount ${amountSatoshis} is below dust threshold ${DUST_THRESHOLD}`); }
    // --- End Validation ---

    // --- Fee Rate ---
    let feeRateSatsPerByte;
    // TODO: Fetch dynamic fee rate using electrumRequestManager.raceRequest('blockchain.estimatefee', [blocks_target])
    // For now, use fixed rates:
    switch (feeLevel) {
      case 'low': feeRateSatsPerByte = 1.1; break;
      case 'high': feeRateSatsPerByte = 3.0; break;
      case 'medium': default: feeRateSatsPerByte = 1.5; break;
    }
    logger.info(`Using fee rate: ${feeRateSatsPerByte} sats/byte for level '${feeLevel}'`);
    // --- End Fee Rate ---

    try {
        logger.info(`Attempting to send ${amountBCH} BCH from ${fromAddress} to ${recipientAddress} (Fee: ${feeLevel})`);

        // 1. Get UTXOs using racing manager
        const scriptHash = addressToScriptHash(fromAddress);
        const utxosRaw = await electrumRequestManager.raceRequest('blockchain.scripthash.listunspent', [scriptHash]);
        if (!utxosRaw || utxosRaw.length === 0) { throw new Error('Insufficient funds (no UTXOs found).'); }

        // 2. Prepare UTXOs for bchjs (needs satoshis value)
        const utxos = utxosRaw.map(utxo => ({
            txid: utxo.tx_hash,
            vout: utxo.tx_pos,
            satoshis: utxo.value, // Electrum provides value in satoshis
            // bchjs might need address/scriptPubKey, but often infers from WIF during signing
        }));

        // 3. Build Transaction using bchjs
        const transactionBuilder = new bchjs.TransactionBuilder(config.network);
        let totalInputSatoshis = 0;
        utxos.forEach(utxo => {
            transactionBuilder.addInput(utxo.txid, utxo.vout);
            totalInputSatoshis += utxo.satoshis;
        });

        // Estimate fee (bchjs helper)
        const byteCount = bchjs.BitcoinCash.getByteCount({ P2PKH: utxos.length }, { P2PKH: 2 }); // 1 recipient, 1 change
        const feeSatoshis = Math.ceil(byteCount * feeRateSatsPerByte);

        // Check funds
        if (totalInputSatoshis < amountSatoshis + feeSatoshis) {
            throw new Error(`Insufficient funds. Required: ${amountSatoshis + feeSatoshis} satoshis, Available: ${totalInputSatoshis} satoshis.`);
        }

        // Add outputs
        transactionBuilder.addOutput(recipientAddress, amountSatoshis);
        const changeAmountSatoshis = totalInputSatoshis - amountSatoshis - feeSatoshis;
        if (changeAmountSatoshis >= DUST_THRESHOLD) {
            transactionBuilder.addOutput(fromAddress, changeAmountSatoshis);
        }

        // 4. Sign Transaction
        const keyPair = bchjs.ECPair.fromWIF(wif);
        utxos.forEach((utxo, index) => {
            transactionBuilder.sign(index, keyPair, undefined, transactionBuilder.hashTypes.SIGHASH_ALL, utxo.satoshis);
        });

        // 5. Build and get Hex
        const tx = transactionBuilder.build();
        const txHex = tx.toHex();

        // 6. Broadcast using racing manager
        logger.info(`Broadcasting transaction hex via racing manager...`);
        const txid = await electrumRequestManager.raceRequest('blockchain.transaction.broadcast', [txHex]);

        if (!txid || typeof txid !== 'string') { // Electrum usually returns txid string on success
             logger.error(`Transaction broadcast attempt did not return a valid txid string. Result: ${txid}`);
             throw new Error('Transaction broadcasted but no valid txid received.');
        }

        logger.info(`Transaction sent successfully via racing. Txid: ${txid}`);
        return { txid }; // Return object expected by controller

    } catch (error) {
        logger.error(`Error sending transaction for user ${userId} via racing: ${error.message}`);
        // Add specific error mapping if needed (e.g., insufficient funds)
        if (error.message.includes('Insufficient funds')) {
            throw new Error('Insufficient funds to cover the amount and transaction fee.');
        }
        if (error.message.includes('timeout')) {
            throw new Error('Network timeout during transaction broadcast. Please check history.');
        }
        throw new Error(`Failed to send transaction: ${error.message}`);
    }
}

// --- REMOVE WebSocket Subscription Logic ---
// This is now handled by spvMonitorService.js
// async function subscribeToWalletUpdates(userId) { ... }
// async function unsubscribeFromWalletUpdates(userId) { ... }


// --- Module Exports ---
module.exports = {
    getWalletAddress,
    getWalletBalance,
    getWalletTransactions,
    sendTransaction,
    // getUserWalletKeys // Keep internal unless needed elsewhere
    // REMOVED: subscribeToWalletUpdates, unsubscribeFromWalletUpdates
};
