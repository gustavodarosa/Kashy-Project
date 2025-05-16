// z:\Kashy-Project\backend\src\services\bchService.js
require('dotenv').config(); // Load environment variables

// --- Library Imports ---
const BCHJS = require('@psf/bch-js');
const ElectrumClient = require('electrum-client');
const crypto = require('crypto');
const cashaddr = require('cashaddrjs');
const bitcore = require('bitcore-lib-cash'); // <<< --- ADD THIS LINE ---
const cryptoUtils = require('../utils/cryptoUtils'); // Assuming path is correct
const logger = require('../utils/logger'); // Assuming path is correct
const { getBchToBrlRate } = require('./exchangeRate'); // Import BRL rate function
const { withTimeout } = require('../utils/asyncUtils'); // Assuming asyncUtils.js exists and exports withTimeout
// --- End Library Imports ---

// --- Configuration ---
const isTestnet = process.env.BCH_NETWORK === 'testnet';
const network = isTestnet ? 'testnet' : 'mainnet'; // network variable used by validateAddress
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
const CONNECTION_TIMEOUT_MS = 10000; // Timeout for establishing connection
const REQUEST_TIMEOUT_MS = 15000; // Timeout for individual requests

const DEFAULT_DERIVATION_PATH = "m/44'/145'/0'/0/0";
const DUST_THRESHOLD = 546; // Minimum satoshis for a standard output
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

function addressToScriptHash(address) {
    const scriptPubKey = addressToP2PKHScriptPubKeyBuffer(address);
    const scriptHashBuffer = crypto.createHash('sha256').update(scriptPubKey).digest();
    return Buffer.from(scriptHashBuffer.reverse()).toString('hex');
}

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

// --- FIXED: validateAddress now has access to bitcore ---
function validateAddress(address) {
    try {
        // Use bitcore for validation as it's generally more robust
        // Ensure 'network' variable is defined in this scope (it is, near the top)
        return bitcore.Address.isValid(address, network);
    } catch (error) {
        // Log the actual error message from bitcore if validation itself throws
        logger.warn(`BCHSERVICE: Address validation error for "${address}": ${error.message}`);
        return false;
    }
}
// --- END FIX ---

async function getBalance(address) {
    logger.debug(`BCHSERVICE: Getting balance for ${address}`);
    let client = null;
    try {
        client = await connectToElectrum();
        const scriptPubKey = addressToP2PKHScriptPubKeyBuffer(address);
        const scriptHashBuffer = crypto.createHash('sha256').update(scriptPubKey).digest();
        const scriptHash = Buffer.from(scriptHashBuffer.reverse()).toString('hex');

        const balanceResult = await withTimeout(
            client.request('blockchain.scripthash.get_balance', [scriptHash]),
            REQUEST_TIMEOUT_MS,
            `Timeout getting balance for ${address}`
        );

        const confirmed = (balanceResult?.confirmed || 0) / SATOSHIS_PER_BCH;
        const unconfirmed = (balanceResult?.unconfirmed || 0) / SATOSHIS_PER_BCH;
        logger.debug(`BCHSERVICE: Balance for ${address}: Confirmed=${confirmed}, Unconfirmed=${unconfirmed}`);
        return {
            balance: confirmed, // Confirmed BCH
            unconfirmedBalance: unconfirmed // Unconfirmed BCH
        };
    } catch (error) {
        logger.error(`BCHSERVICE: Error getting balance for ${address}: ${error.message}`);
        if (error.stack) { logger.error(error.stack); }
        throw error; // Re-throw the error to be handled by the caller
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
        await withTimeout(
            client.connect('kashy-bch-service', '1.4'),
            CONNECTION_TIMEOUT_MS,
            `Connection timeout to ${ELECTRUM_HOST}:${ELECTRUM_PORT}`
        );
        await withTimeout(
            client.server_version('kashy-bch-service', '1.4'),
            REQUEST_TIMEOUT_MS,
            `Server version timeout for ${ELECTRUM_HOST}:${ELECTRUM_PORT}`
        );
        logger.debug('Connected to Electrum.');
        return client;
    } catch (err) {
        logger.error(`Failed to connect to Electrum: ${err.message}`);
        if (client) { try { await client.close(); } catch { /* ignore */ } }
        throw err; // Re-throw error
    }
}

function calculateScriptHashFromKeyPair(keyPair) {
    try {
        // Ensure publicKey buffer exists
        if (!keyPair.publicKey && keyPair.getPublicKeyBuffer) {
             keyPair.publicKey = keyPair.getPublicKeyBuffer();
        } else if (!keyPair.publicKey) {
             throw new Error("KeyPair lacks publicKey buffer and method to get it.");
        }
        const publicKeyBuffer = keyPair.publicKey;
        const hash160 = bchjs.Crypto.hash160(publicKeyBuffer);
        // Construct P2PKH scriptPubKey
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

    const utxosRaw = await withTimeout(
        client.request('blockchain.scripthash.listunspent', [scriptHash]),
        REQUEST_TIMEOUT_MS,
        `Timeout getting UTXOs for ${address}`
    );

    logger.debug(`UTXOs (listunspent) obtidos: ${utxosRaw.length}`);
    if (!utxosRaw || utxosRaw.length === 0) { return []; }

    const utxos = [];
    let currentHeight = 0;
    try {
        // Fetch current height for confirmations (optional, can fail gracefully)
        const header = await withTimeout(
            client.request('blockchain.headers.subscribe', []),
            REQUEST_TIMEOUT_MS,
            `Timeout getting block height for UTXO confirmations`
        );
        currentHeight = header?.height || 0;
    } catch (heightError) {
        logger.warn(`Could not fetch current block height for confirmations: ${heightError.message}`);
    }

    for (const utxo of utxosRaw) {
        logger.debug(`Processing UTXO: hash=${utxo.tx_hash}, index=${utxo.tx_pos}, value=${utxo.value}`);
        utxos.push({
            txid: utxo.tx_hash,
            vout: utxo.tx_pos,
            amount: utxo.value / SATOSHIS_PER_BCH, // value is in satoshis
            satoshis: utxo.value,
            height: utxo.height,
            confirmations: utxo.height > 0 && currentHeight > 0 ? currentHeight - utxo.height + 1 : 0,
        });
    }
    return utxos;
}

// --- sendTransactionWithElectrum with DIAGNOSTIC LOGGING ---
async function sendTransactionWithElectrum(fromWif, toAddress, amountBCH, feeLevel = 'medium') {
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
        // *** ADDED UTXO LOGGING ***
        logger.info(`[Send TX] Found ${utxos.length} UTXOs for address ${fromAddress}: ${JSON.stringify(utxos.map(u => ({ vout: u.vout, satoshis: u.satoshis, txid: u.txid.substring(0,10)+'...' })))}`);
        // *** END LOGGING ***
        if (!utxos || utxos.length === 0) { throw new Error('Saldo insuficiente (nenhum UTXO encontrado).'); }

        const transactionBuilder = new bchjs.TransactionBuilder(network);
        const sendAmountSatoshis = Math.round(amountBCH * SATOSHIS_PER_BCH);
        let totalInputSatoshis = 0;

        utxos.forEach(utxo => {
            transactionBuilder.addInput(utxo.txid, utxo.vout);
            totalInputSatoshis += utxo.satoshis;
        });
        logger.debug(`Total inputs added: ${utxos.length}, Total value: ${totalInputSatoshis} satoshis`);

        // *** ADDED FEE LEVEL LOGGING ***
        logger.info(`[Send TX] Received feeLevel parameter: ${feeLevel}`);
        // *** END LOGGING ***
        let feeRateSatsPerByte;
        switch (feeLevel) {
          case 'low': feeRateSatsPerByte = 1.0; break; // Minimum relay fee
          case 'high': feeRateSatsPerByte = 1.5; break; // Slightly higher for priority
          case 'medium': default: feeRateSatsPerByte = 1.1; break; // Default slightly above minimum
        }
        logger.info(`Using fee rate: ${feeRateSatsPerByte} sats/byte for level '${feeLevel}'`);

        // Determine if change output is needed BEFORE calculating exact byte count
        const preliminaryFeeEstimate = Math.ceil(bchjs.BitcoinCash.getByteCount({ P2PKH: utxos.length }, { P2PKH: 2 }) * feeRateSatsPerByte); // Estimate with change
        const changeAmountPreliminary = totalInputSatoshis - sendAmountSatoshis - preliminaryFeeEstimate;
        const needsChangeOutput = changeAmountPreliminary >= DUST_THRESHOLD;

        // Calculate final byte count based on whether change is needed
        const outputCount = needsChangeOutput ? { P2PKH: 2 } : { P2PKH: 1 };
        const byteCount = bchjs.BitcoinCash.getByteCount({ P2PKH: utxos.length }, outputCount);
        const feeSatoshis = Math.ceil(byteCount * feeRateSatsPerByte);
        // *** ADDED FEE CALC LOGGING ***
        logger.info(`[Send TX] Calculated: byteCount=${byteCount}, feeSatoshis=${feeSatoshis}, needsChange=${needsChangeOutput}, numInputs=${utxos.length}, numOutputs=${needsChangeOutput ? 2 : 1}`);
        // *** END LOGGING ***

        // Final check for sufficient funds
        if (totalInputSatoshis < sendAmountSatoshis + feeSatoshis) { // This is line ~288
            // Log details right before throwing
            logger.error(`[Send TX] Insufficient funds check failed: totalInput=${totalInputSatoshis}, amountToSend=${sendAmountSatoshis}, calculatedFee=${feeSatoshis}, requiredTotal=${sendAmountSatoshis + feeSatoshis}`);
            throw new Error(`Saldo insuficiente para completar a transação (incluindo taxa). Necessário: ${sendAmountSatoshis + feeSatoshis} sats, Disponível: ${totalInputSatoshis} sats.`);
        }

        transactionBuilder.addOutput(toAddress, sendAmountSatoshis);
        const changeAmountSatoshis = totalInputSatoshis - sendAmountSatoshis - feeSatoshis;
        if (needsChangeOutput) { // Use the flag determined earlier
            logger.debug(`Adding change output: ${changeAmountSatoshis} satoshis to ${fromAddress}`);
            transactionBuilder.addOutput(fromAddress, changeAmountSatoshis);
        } else {
            logger.debug(`No change output needed or change amount below dust threshold (${changeAmountSatoshis} sats).`);
            // Any tiny amount left over effectively goes to miners as extra fee
        }

        logger.debug('Signing inputs...');
        utxos.forEach((utxo, index) => {
            transactionBuilder.sign(index, keyPair, undefined, transactionBuilder.hashTypes.SIGHASH_ALL, utxo.satoshis);
        });

        logger.debug('Building final transaction...');
        const tx = transactionBuilder.build();
        const txHex = tx.toHex();
        logger.debug(`Transaction built (Electrum/BCHJS). Broadcasting...`);

        const txid = await withTimeout(
            client.request('blockchain.transaction.broadcast', [txHex]),
            REQUEST_TIMEOUT_MS,
            `Timeout broadcasting transaction`
        );

        if (!txid || typeof txid !== 'string' || txid.length < 64) { // Basic check for valid txid format
            logger.error(`Transaction broadcast attempt did not return a valid txid string. Result: ${txid}`);
            throw new Error('Transaction broadcasted but no valid txid received.');
        }

        logger.info(`Transaction broadcast successfully via Electrum. TXID: ${txid}`);
        return txid; // Return only the txid string

    } catch (error) {
        logger.error(`Error sending transaction (Electrum/BCHJS): ${error.message}`);
        if (error.stack) logger.error(`Stack Trace: ${error.stack}`);
        // Ensure specific error message is passed
        if (error.message.includes('Insufficient funds') || error.message.includes('Saldo insuficiente')) {
             throw new Error(error.message); // Keep the specific backend message
        }
        // Add more specific error handling if needed (e.g., dust errors)
        throw new Error(`Erro ao enviar transação: ${error.message}`);
    } finally {
        if (client) { try { await client.close(); logger.debug('Electrum connection closed after send transaction.'); } catch { /* ignore */ } }
    }
}
// --- END sendTransactionWithElectrum ---


// --- getTransactionHistoryFromElectrum (No changes from previous version needed for this specific error) ---
async function getTransactionHistoryFromElectrum(bchAddress, limit = 20) {
    logger.info(`BCHSERVICE: Fetching live history for ${bchAddress} (limit: ${limit})`);
    let client = null;
    const formattedTransactions = [];

    try {
        const rate = await getBchToBrlRate();
        client = await connectToElectrum();

        let scriptHash;
        try {
            const outputScript = addressToP2PKHScriptPubKeyBuffer(bchAddress);
            const scriptHashBuffer = crypto.createHash('sha256').update(outputScript).digest();
            scriptHash = Buffer.from(scriptHashBuffer.reverse()).toString('hex');
        } catch (hashError) {
            logger.error(`BCHSERVICE: Error calculating script hash for ${bchAddress}: ${hashError.message}`);
            throw new Error(`Failed to calculate script hash for history: ${hashError.message}`);
        }

        const history = await withTimeout(
            client.request('blockchain.scripthash.get_history', [scriptHash]),
            REQUEST_TIMEOUT_MS,
            `Timeout getting history for ${bchAddress}`
        );
        logger.info(`BCHSERVICE: Found ${history?.length || 0} history items for ${bchAddress}. Processing latest ${limit}.`);

        let currentHeight = 0;
        try {
            const header = await withTimeout(
                client.request('blockchain.headers.subscribe', []),
                REQUEST_TIMEOUT_MS,
                `Timeout getting block height for history confirmations`
            );
            currentHeight = header?.height || 0;
        } catch (heightError) {
            logger.warn(`Could not fetch current block height for confirmations: ${heightError.message}`);
        }

        const relevantHistory = (history || []).reverse().slice(0, limit);
        const detailPromises = relevantHistory.map(item => {
            logger.debug(`[History] Preparing to fetch details for ${item.tx_hash}`);
            return withTimeout(
                client.request('blockchain.transaction.get', [item.tx_hash, true]),
                REQUEST_TIMEOUT_MS, // Apply timeout to detail fetching too
                `Timeout fetching details for ${item.tx_hash}`
            )
            .then(details => {
                logger.debug(`[History] Successfully fetched details for ${item.tx_hash}`);
                return details;
            })
            .catch(err => {
                logger.error(`BCHSERVICE: Failed fetching details for ${item.tx_hash}: ${err.message}`);
                return null; // Return null on failure for this specific tx
            });
        });
        const transactionDetailsList = await Promise.all(detailPromises);

        // --- START REVISED PROCESSING LOGIC (PRIORITIZE RECEIVED) ---
        relevantHistory.forEach((item, index) => {
            const txDetails = transactionDetailsList[index];
            if (!txDetails) {
                logger.warn(`[History] Skipping processing for ${item.tx_hash} due to fetch failure.`);
                return; // Skip if details failed
            }

            try { // Add try...catch around processing
                let receivedSatoshis = 0;
                let sentSatoshis = 0; // Satoshis sent to addresses OTHER than bchAddress
                let firstOtherRecipient = null;
                let displayAddress = 'N/A'; // Address to display in UI

                // Calculate received and sent amounts from outputs
                for (const output of txDetails.vout) {
                    const outputValueSat = Math.round((output.value || 0) * SATOSHIS_PER_BCH);
                    if (output.scriptPubKey?.addresses?.includes(bchAddress)) {
                        receivedSatoshis += outputValueSat;
                    } else {
                        sentSatoshis += outputValueSat;
                        if (!firstOtherRecipient && output.scriptPubKey?.addresses?.[0]) {
                            firstOtherRecipient = output.scriptPubKey.addresses[0];
                        }
                    }
                }

                const feeSatoshis = txDetails.fee ? Math.round(txDetails.fee * SATOSHIS_PER_BCH) : 0;

                // --- Revised Type and Amount Determination (Prioritize Received) ---
                let type = 'unknown';
                let amountSatoshis = 0; // The primary amount for display

                if (receivedSatoshis > 0) {
                    type = 'received';
                    amountSatoshis = receivedSatoshis;
                    displayAddress = bchAddress;
                    logger.debug(`[TX Classify] TXID: ${item.tx_hash} - Classified as RECEIVED. Amount: ${amountSatoshis} sats.`);
                } else if (sentSatoshis > 0) {
                    type = 'sent';
                    amountSatoshis = sentSatoshis;
                    displayAddress = firstOtherRecipient || 'Multiple Recipients';
                    logger.debug(`[TX Classify] TXID: ${item.tx_hash} - Classified as SENT. Amount: ${amountSatoshis} sats.`);
                } else {
                    type = 'unknown';
                    amountSatoshis = 0;
                    displayAddress = 'N/A';
                    logger.warn(`[TX Classify] TXID: ${item.tx_hash} - Classified as UNKNOWN. Zero relevant outputs for ${bchAddress}.`);
                }
                // --- End Revised Logic ---

                const amountBCH = amountSatoshis / SATOSHIS_PER_BCH;
                const amountBRL = amountBCH * rate;
                const feeBCH = feeSatoshis / SATOSHIS_PER_BCH;
                const confirmations = item.height > 0 && currentHeight > 0 ? currentHeight - item.height + 1 : 0;

                formattedTransactions.push({
                    _id: item.tx_hash,
                    type: type,
                    amountBCH: amountBCH,
                    amountBRL: amountBRL,
                    address: displayAddress,
                    txid: item.tx_hash,
                    timestamp: txDetails.blocktime ? new Date(txDetails.blocktime * 1000).toISOString() : new Date().toISOString(),
                    status: item.height > 0 ? 'confirmed' : 'pending',
                    confirmations: confirmations,
                    blockHeight: item.height > 0 ? item.height : undefined,
                    fee: type === 'sent' ? feeBCH : undefined,
                });
            } catch (processingError) {
                logger.error(`[History] Error processing details for ${item.tx_hash}: ${processingError.message}`);
                // Continue to next transaction if one fails processing
            }
        });
        // --- END REVISED PROCESSING LOGIC ---

        formattedTransactions.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

        logger.info(`BCHSERVICE: Formatted ${formattedTransactions.length} transactions for ${bchAddress}.`);
        return formattedTransactions;

    } catch (error) {
        logger.error(`BCHSERVICE: Error fetching/formatting live history for ${bchAddress}: ${error.message}`);
        if (error.stack) { logger.error(error.stack); }
        throw error; // Re-throw error
    } finally {
        if (client) {
            try { await client.close(); logger.debug('Electrum connection closed after history fetch.'); } catch { /* ignore */ }
        }
    }
}
// --- END getTransactionHistoryFromElectrum ---

async function verifyPayment(address, expectedAmount) {
    const client = await connectToElectrum();
    const scriptHash = addressToScriptHash(address);

    const utxos = await client.request('blockchain.scripthash.listunspent', [scriptHash]);
    const totalReceived = utxos.reduce((sum, utxo) => sum + utxo.value, 0) / SATOSHIS_PER_BCH;

    return totalReceived >= expectedAmount;
}

// --- End Electrum Implementation Functions ---


// --- Module Exports ---
module.exports = {
    generateAddress,
    validateAddress,
    getBalance,
    derivePrivateKey,
    sendTransaction: sendTransactionWithElectrum, // Export the updated send function
    getTransactionHistoryFromElectrum, // Export the updated history function
    connectToElectrum, // Export if needed elsewhere (though maybe not needed externally now)
    verifyPayment, // Export the new verifyPayment function
};
// --- End Module Exports ---
