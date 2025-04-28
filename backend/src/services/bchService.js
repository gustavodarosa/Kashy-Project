// z:\Kashy-Project\backend\src\services\bchService.js
require('dotenv').config(); // Load environment variables

// --- Library Imports ---
const BCHJS = require('@psf/bch-js');
const ElectrumClient = require('electrum-client');
const crypto = require('crypto');
const cashaddr = require('cashaddrjs');
const cryptoUtils = require('../utils/cryptoUtils'); // Assuming path is correct
const logger = require('../utils/logger'); // Assuming path is correct
const { getBchToBrlRate } = require('./exchangeRate'); // Import BRL rate function
// --- End Library Imports ---

// --- Configuration ---
const isTestnet = process.env.BCH_NETWORK === 'testnet';
const network = isTestnet ? 'testnet' : 'mainnet';
const SATOSHIS_PER_BCH = 1e8; // Use constant 1e8

// Initialize bchjs with restURL
const bchjsOptions = {};
if (isTestnet && process.env.BCH_TESTNET_API) {
    bchjsOptions.restURL = process.env.BCH_TESTNET_API;
} else if (!isTestnet && process.env.BCH_MAINNET_API) {
    bchjsOptions.restURL = process.env.BCH_MAINNET_API;
} else {
    bchjsOptions.restURL = 'https://api.mainnet.cash';
    logger.warn('BCHSERVICE: BCH_MAINNET_API/BCH_TESTNET_API environment variable not set. Using default restURL.');
}
const bchjs = new BCHJS(bchjsOptions);

// Electrum Server Configuration (Used for direct connection in this service)
const ELECTRUM_HOST = process.env.ELECTRUM_HOST || 'bch.imaginary.cash';
const ELECTRUM_PORT = parseInt(process.env.ELECTRUM_PORT || '50002', 10);
const ELECTRUM_PROTOCOL = process.env.ELECTRUM_PROTOCOL || 'ssl';

const DEFAULT_DERIVATION_PATH = "m/44'/145'/0'/0/0";
const DUST_THRESHOLD = 546;
// --- End Configuration ---

// --- Helper Function for ScriptPubKey Generation (Manual Method) ---
function addressToP2PKHScriptPubKeyBuffer(address) {
    try {
        const { type, hash } = cashaddr.decode(address);
        if (type !== 'P2PKH') {
            throw new Error(`Unsupported address type for P2PKH script generation: ${type}`);
        }
        const hashBuffer = Buffer.from(hash);
        return Buffer.concat([
            Buffer.from([0x76]), Buffer.from([0xa9]), Buffer.from([hashBuffer.length]), hashBuffer,
            Buffer.from([0x88]), Buffer.from([0xac])
        ]);
    } catch (e) {
        logger.error(`BCHSERVICE: Error converting address ${address} to P2PKH scriptPubKey: ${e.message}`);
        throw e;
    }
}
// --- End Helper Function ---


// --- Wallet Functions ---

const generateAddress = async () => {
    logger.info('BCHSERVICE: Generating new BCH address...');
    try {
        const lang = 'english';
        const mnemonic = bchjs.Mnemonic.generate(128, bchjs.Mnemonic.wordLists()[lang]);
        const rootSeedBuffer = await bchjs.Mnemonic.toSeed(mnemonic);
        const masterHDNode = bchjs.HDNode.fromSeed(rootSeedBuffer, network);
        const childNode = masterHDNode.derivePath(DEFAULT_DERIVATION_PATH);
        const address = bchjs.HDNode.toCashAddress(childNode);

        logger.info(`BCHSERVICE: Address generated successfully: ${address}`);
        return { mnemonic, address, derivationPath: DEFAULT_DERIVATION_PATH };
    } catch (error) {
        logger.error(`BCHSERVICE: Error during address generation: ${error.message}`);
        logger.error(error.stack);
        throw new Error(`Failed to generate BCH wallet details: ${error.message}`);
    }
};

function validateAddress(address) {
    try {
        return bchjs.Address.isCashAddress(address) || bchjs.Address.isLegacyAddress(address);
    } catch (error) {
        logger.warn(`BCHSERVICE: Address validation error for "${address}": ${error.message}`);
        return false;
    }
}

async function getBalance(address) {
    logger.debug(`BCHSERVICE: Getting balance for ${address}`);
    let client = null;
    try {
        client = await connectToElectrum();
        const scriptPubKey = addressToP2PKHScriptPubKeyBuffer(address);
        const scriptHashBuffer = crypto.createHash('sha256').update(scriptPubKey).digest();
        const scriptHash = Buffer.from(scriptHashBuffer.reverse()).toString('hex');
        const balanceResult = await client.request('blockchain.scripthash.get_balance', [scriptHash]);
        const confirmed = (balanceResult?.confirmed || 0) / SATOSHIS_PER_BCH;
        const unconfirmed = (balanceResult?.unconfirmed || 0) / SATOSHIS_PER_BCH;
        logger.debug(`BCHSERVICE: Balance for ${address}: Confirmed=${confirmed}, Unconfirmed=${unconfirmed}`);
        return { balance: confirmed, unconfirmedBalance: unconfirmed };
    } catch (error) {
        logger.error(`BCHSERVICE: Error getting balance for ${address}: ${error.message}`);
        if (error.stack) { logger.error(error.stack); }
        throw error;
    } finally {
        if (client) { try { await client.close(); } catch { /* ignore */ } }
    }
}

async function derivePrivateKey(encryptedMnemonic, encryptedDerivationPath, encryptionKey) {
    logger.debug('BCHSERVICE: Deriving private key from encrypted data...');
    try {
        const mnemonic = cryptoUtils.decrypt(encryptedMnemonic, encryptionKey);
        const derivationPath = cryptoUtils.decrypt(encryptedDerivationPath, encryptionKey);
        const rootSeedBuffer = await bchjs.Mnemonic.toSeed(mnemonic);
        const masterHDNode = bchjs.HDNode.fromSeed(rootSeedBuffer, network);
        const childNode = masterHDNode.derivePath(derivationPath);
        const wif = bchjs.HDNode.toWIF(childNode);
        logger.debug('BCHSERVICE: Private key derived successfully.');
        return wif;
    } catch (error) {
        logger.error(`BCHSERVICE: Error deriving private key: ${error.message}`);
        logger.error(error.stack);
        throw new Error(`Erro ao derivar chave privada: ${error.message}`);
    }
}
// --- End Wallet Functions ---


// --- Electrum Implementation Functions ---

async function connectToElectrum() {
    logger.debug(`Connecting to Electrum: ${ELECTRUM_HOST}:${ELECTRUM_PORT} (${ELECTRUM_PROTOCOL})`);
    const client = new ElectrumClient(ELECTRUM_PORT, ELECTRUM_HOST, ELECTRUM_PROTOCOL);
    try {
        await client.connect('kashy-bch-service', '1.4');
        await client.server_version('kashy-bch-service', '1.4');
        logger.debug('Connected to Electrum.');
        return client;
    } catch (err) {
        logger.error(`Failed to connect to Electrum: ${err.message}`);
        if (client) { try { await client.close(); } catch { /* ignore */ } }
        throw err;
    }
}

function calculateScriptHashFromKeyPair(keyPair) {
    try {
        if (!keyPair || !keyPair.publicKey) {
            if (!keyPair.publicKey && keyPair.getPublicKeyBuffer) {
                 keyPair.publicKey = keyPair.getPublicKeyBuffer();
            } else if (!keyPair.publicKey) {
                 throw new Error("KeyPair lacks publicKey buffer and method to get it.");
            }
        }
        const publicKeyBuffer = keyPair.publicKey;
        const hash160 = bchjs.Crypto.hash160(publicKeyBuffer);
        const scriptPubKey = Buffer.concat([
            Buffer.from([0x76]), Buffer.from([0xa9]), Buffer.from([hash160.length]), hash160,
            Buffer.from([0x88]), Buffer.from([0xac])
        ]);
        const scriptHashBuffer = crypto.createHash('sha256').update(scriptPubKey).digest();
        return Buffer.from(scriptHashBuffer.reverse()).toString('hex');
    } catch (error) {
        logger.error(`Error in calculateScriptHashFromKeyPair: ${error.message}`);
        throw error;
    }
}

async function getUTXOsElectrumForKeyPair(client, keyPair, address) {
    const scriptHash = calculateScriptHashFromKeyPair(keyPair);
    logger.debug(`Obtendo UTXOs (listunspent) para o endereço ${address} (scriptHash: ${scriptHash})...`);
    const utxosRaw = await client.request('blockchain.scripthash.listunspent', [scriptHash]);
    logger.debug(`UTXOs (listunspent) obtidos: ${utxosRaw.length}`);
    if (!utxosRaw || utxosRaw.length === 0) { return []; }

    logger.debug('Fetching raw transaction data for each UTXO...');
    const utxos = [];
    let currentHeight = 0;
    try {
        const header = await client.request('blockchain.headers.subscribe', []);
        currentHeight = header?.height || 0;
    } catch (heightError) {
        logger.warn(`Could not fetch current block height for confirmations: ${heightError.message}`);
    }

    let scriptPubKeyBuffer = null;
    try {
        scriptPubKeyBuffer = addressToP2PKHScriptPubKeyBuffer(address);
    } catch (scriptErr) {
         logger.error(`Failed to generate scriptPubKey for UTXOs of ${address}: ${scriptErr.message}`);
         throw new Error(`Failed to generate scriptPubKey for UTXOs: ${scriptErr.message}`);
    }
    if (!scriptPubKeyBuffer) { throw new Error(`Failed to generate scriptPubKey Buffer for address ${address}`); }

    for (const utxo of utxosRaw) {
        logger.debug(`Processing UTXO: hash=${utxo.tx_hash}, index=${utxo.tx_pos}, value=${utxo.value}`);
        try {
            const txHex = await client.request('blockchain.transaction.get', [utxo.tx_hash]);
            utxos.push({
                txid: utxo.tx_hash, vout: utxo.tx_pos, amount: utxo.value / SATOSHIS_PER_BCH,
                satoshis: utxo.value, height: utxo.height,
                confirmations: utxo.height > 0 && currentHeight > 0 ? currentHeight - utxo.height + 1 : 0,
                scriptPubKey: scriptPubKeyBuffer, txHex: txHex
            });
        } catch (hexError) {
            logger.error(`Failed to fetch raw transaction hex for UTXO ${utxo.tx_hash}: ${hexError.message}`);
        }
    }
    return utxos;
}

async function sendTransactionWithElectrum(fromWif, toAddress, amountBCH, feeLevel = 'medium') { // Added feeLevel param
    let client = null;
    logger.info(`Iniciando transação (Electrum/BCHJS) para ${toAddress}, Valor: ${amountBCH} BCH, Fee: ${feeLevel}`);

    try {
        client = await connectToElectrum();
        logger.debug('Conectado ao servidor Electrum.');

        const keyPair = bchjs.ECPair.fromWIF(fromWif);
        if (!keyPair.publicKey && keyPair.getPublicKeyBuffer) { keyPair.publicKey = keyPair.getPublicKeyBuffer(); }
        if (!keyPair.publicKey) { throw new Error("Failed to obtain public key buffer from WIF."); }

        const fromAddress = bchjs.ECPair.toCashAddress(keyPair);
        logger.info(`Sender address (derived from bchjs): ${fromAddress}`);

        const utxos = await getUTXOsElectrumForKeyPair(client, keyPair, fromAddress);
        if (!utxos || utxos.length === 0) { throw new Error('Insufficient balance (no UTXOs found).'); }

        const transactionBuilder = new bchjs.TransactionBuilder(network);
        const sendAmountSatoshis = Math.round(amountBCH * SATOSHIS_PER_BCH);
        let totalInputSatoshis = 0;

        utxos.forEach(utxo => {
            transactionBuilder.addInput(utxo.txid, utxo.vout, transactionBuilder.DEFAULT_SEQUENCE, utxo.scriptPubKey);
            totalInputSatoshis += utxo.satoshis;
        });
        logger.debug(`Total inputs added: ${utxos.length}, Total value: ${totalInputSatoshis} satoshis`);

        // --- Fee Calculation ---
        let feeRateSatsPerByte;
        switch (feeLevel) {
          case 'low': feeRateSatsPerByte = 1.1; break;
          case 'high': feeRateSatsPerByte = 3.0; break;
          case 'medium': default: feeRateSatsPerByte = 1.5; break;
        }
        logger.info(`Using fee rate: ${feeRateSatsPerByte} sats/byte for level '${feeLevel}'`);
        const byteCount = bchjs.BitcoinCash.getByteCount({ P2PKH: utxos.length }, { P2PKH: 2 }); // 1 recipient, 1 change
        const feeSatoshis = Math.ceil(byteCount * feeRateSatsPerByte);
        logger.info(`Estimated fee: ${feeSatoshis} satoshis`);
        // --- End Fee Calculation ---

        if (totalInputSatoshis < sendAmountSatoshis + feeSatoshis) {
            throw new Error(`Insufficient funds. Required: ${sendAmountSatoshis + feeSatoshis} satoshis, Available: ${totalInputSatoshis} satoshis.`);
        }

        transactionBuilder.addOutput(toAddress, sendAmountSatoshis);
        const changeAmountSatoshis = totalInputSatoshis - sendAmountSatoshis - feeSatoshis;
        if (changeAmountSatoshis >= DUST_THRESHOLD) {
            transactionBuilder.addOutput(fromAddress, changeAmountSatoshis);
        }

        logger.debug('Signing inputs...');
        utxos.forEach((utxo, index) => {
            transactionBuilder.sign(index, keyPair, undefined, transactionBuilder.hashTypes.SIGHASH_ALL, utxo.satoshis);
        });

        logger.debug('Building final transaction...');
        const tx = transactionBuilder.build();
        const txHex = tx.toHex();
        logger.debug(`Transaction built (Electrum/BCHJS). Broadcasting...`);

        const txid = await client.request('blockchain.transaction.broadcast', [txHex]);
        logger.info(`Transaction broadcast successfully via Electrum. TXID: ${txid}`);
        return txid; // Return only txid

    } catch (error) {
        logger.error(`Error sending transaction (Electrum/BCHJS): ${error.message}`);
        if (error.stack) logger.error(`Stack Trace: ${error.stack}`);
        throw new Error(`Error sending transaction (Electrum/BCHJS): ${error.message}`);
    } finally {
        if (client) { try { await client.close(); logger.debug('Electrum connection closed after send transaction.'); } catch { /* ignore */ } }
    }
}


/**
 * Fetches and processes transaction history live from Electrum for a given address.
 * Includes BRL calculation.
 * @param {string} bchAddress - The Bitcoin Cash address.
 * @param {number} [limit=20] - Maximum number of transactions to fetch and process.
 * @returns {Promise<Array<object>>} - Array of formatted transaction objects (similar to AppTransaction).
 */
async function getTransactionHistoryFromElectrum(bchAddress, limit = 20) {
    logger.info(`BCHSERVICE: Fetching live history for ${bchAddress} (limit: ${limit})`);
    let client = null;
    const formattedTransactions = [];

    try {
        // Fetch rate ONCE before processing transactions
        const rate = await getBchToBrlRate();
        client = await connectToElectrum();

        // --- Calculate Script Hash ---
        let scriptHash;
        try {
            const outputScript = addressToP2PKHScriptPubKeyBuffer(bchAddress);
            const scriptHashBuffer = crypto.createHash('sha256').update(outputScript).digest();
            scriptHash = Buffer.from(scriptHashBuffer.reverse()).toString('hex');
        } catch (hashError) {
            logger.error(`BCHSERVICE: Error calculating script hash for ${bchAddress}: ${hashError.message}`);
            throw new Error(`Failed to calculate script hash for history: ${hashError.message}`);
        }
        // --- End Script Hash Calculation ---

        const history = await client.request('blockchain.scripthash.get_history', [scriptHash]);
        logger.info(`BCHSERVICE: Found ${history?.length || 0} history items for ${bchAddress}. Processing latest ${limit}.`);

        // Get current height for confirmations
        let currentHeight = 0;
        try {
            const header = await client.request('blockchain.headers.subscribe', []);
            currentHeight = header?.height || 0;
        } catch (heightError) {
            logger.warn(`Could not fetch current block height for confirmations: ${heightError.message}`);
        }

        // Process only the most recent 'limit' transactions
        const relevantHistory = (history || []).reverse().slice(0, limit);

        // Fetch details concurrently
        const detailPromises = relevantHistory.map(item =>
            client.request('blockchain.transaction.get', [item.tx_hash, true])
                .catch(err => {
                    logger.error(`BCHSERVICE: Failed fetching details for ${item.tx_hash}: ${err.message}`);
                    return null; // Allow Promise.all to continue
                })
        );
        const transactionDetailsList = await Promise.all(detailPromises);

        // Process and format
        relevantHistory.forEach((item, index) => {
            const txDetails = transactionDetailsList[index];
            if (!txDetails) return; // Skip if details failed

            let amountSatoshis = 0;
            let type = 'unknown';
            let receivedSatoshis = 0;
            let firstOtherRecipient = null;

            // Calculate received amount and find first other recipient
            for (const output of txDetails.vout) {
                const outputValueSat = output.valueSat ?? Math.round((output.value || 0) * SATOSHIS_PER_BCH);
                if (output.scriptPubKey?.addresses?.includes(bchAddress)) {
                    receivedSatoshis += outputValueSat;
                } else if (!firstOtherRecipient && output.scriptPubKey?.addresses?.[0]) {
                    firstOtherRecipient = output.scriptPubKey.addresses[0];
                }
            }

            const feeSatoshis = txDetails.fee ? Math.round(txDetails.fee * SATOSHIS_PER_BCH) : 0;

            // Determine type and amount (heuristic)
            if (receivedSatoshis > 0) {
                // If outputs to others exist, assume it's change from a sent tx
                if (firstOtherRecipient) {
                    type = 'sent';
                    // Estimate amount sent = total outputs - received by user (change)
                    const totalOutputSat = txDetails.vout.reduce((sum, vout) => sum + (vout.valueSat ?? Math.round((vout.value || 0) * SATOSHIS_PER_BCH)), 0);
                    amountSatoshis = totalOutputSat - receivedSatoshis;
                } else { // Only received outputs to user
                    type = 'received';
                    amountSatoshis = receivedSatoshis;
                }
            } else if (firstOtherRecipient) { // No output to user, must be sending
                type = 'sent';
                // Estimate amount = total outputs
                amountSatoshis = txDetails.vout.reduce((sum, vout) => sum + (vout.valueSat ?? Math.round((vout.value || 0) * SATOSHIS_PER_BCH)), 0);
            }
            // Ensure amount is not negative
            if (amountSatoshis < 0) amountSatoshis = 0;

            const amountBCH = amountSatoshis / SATOSHIS_PER_BCH;
            const amountBRL = amountBCH * rate; // Calculate BRL value
            const feeBCH = feeSatoshis / SATOSHIS_PER_BCH;

            // Determine display address
            let displayAddress = 'N/A';
            if (type === 'received') {
                displayAddress = bchAddress; // Show own address for received
            } else if (type === 'sent') {
                displayAddress = firstOtherRecipient || 'Multiple Recipients'; // Show first recipient or generic
            }

            const confirmations = item.height > 0 && currentHeight > 0 ? currentHeight - item.height + 1 : 0;

            formattedTransactions.push({
                _id: item.tx_hash, // Use txid as _id
                type: type,
                amountBCH: amountBCH,
                amountBRL: amountBRL, // Add BRL amount
                address: displayAddress, // Address shown in UI
                txid: item.tx_hash,
                timestamp: txDetails.blocktime ? new Date(txDetails.blocktime * 1000).toISOString() : new Date().toISOString(),
                status: item.height > 0 ? 'confirmed' : 'pending',
                confirmations: confirmations,
                blockHeight: item.height > 0 ? item.height : undefined,
                fee: type === 'sent' ? feeBCH : undefined, // Fee only relevant for sent txs
            });
        });

        // Sort by timestamp descending
        formattedTransactions.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

        logger.info(`BCHSERVICE: Formatted ${formattedTransactions.length} transactions for ${bchAddress}.`);
        return formattedTransactions;

    } catch (error) {
        logger.error(`BCHSERVICE: Error fetching/formatting live history for ${bchAddress}: ${error.message}`);
        if (error.stack) { logger.error(error.stack); }
        throw error; // Re-throw
    } finally {
        if (client) {
            try { await client.close(); logger.debug('Electrum connection closed after history fetch.'); } catch { /* ignore */ }
        }
    }
}
// --- End Electrum Implementation Functions ---


// --- Module Exports ---
module.exports = {
    generateAddress,
    validateAddress,
    getBalance,
    derivePrivateKey,
    sendTransaction: sendTransactionWithElectrum, // Ensure this is exported
    getTransactionHistoryFromElectrum, // Export the updated function
    connectToElectrum,
    // addressToP2PKHScriptPubKeyBuffer // Keep internal unless needed elsewhere
  };
// --- End Module Exports ---
