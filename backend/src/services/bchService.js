// z:\Kashy-Project\backend\src\services\bchService.js
require('dotenv').config(); // Load environment variables

// --- Library Imports ---
const BCHJS = require('@psf/bch-js');
const ElectrumClient = require('electrum-client');
const crypto = require('crypto');
const cashaddr = require('cashaddrjs'); // <-- ADDED: Import cashaddrjs
const cryptoUtils = require('../utils/cryptoUtils'); // Assuming path is correct
const logger = require('../utils/logger'); // Assuming path is correct
// --- End Library Imports ---

// --- Configuration ---
const isTestnet = process.env.BCH_NETWORK === 'testnet';
const network = isTestnet ? 'testnet' : 'mainnet';
const SATOSHIS_PER_BCH = 1e8;

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

// Electrum Server Configuration
const ELECTRUM_HOST = process.env.ELECTRUM_HOST || 'bch.imaginary.cash';
const ELECTRUM_PORT = parseInt(process.env.ELECTRUM_PORT || '50002', 10);
const ELECTRUM_PROTOCOL = process.env.ELECTRUM_PROTOCOL || 'ssl';

const DEFAULT_DERIVATION_PATH = "m/44'/145'/0'/0/0";
const DUST_THRESHOLD = 546;
// --- End Configuration ---

// --- Helper Function for ScriptPubKey Generation (Manual Method) ---
/**
 * Generates the P2PKH scriptPubKey buffer from a cash address.
 * @param {string} address - The Bitcoin Cash address (cashaddr format).
 * @returns {Buffer} - The scriptPubKey buffer.
 * @throws {Error} If address decoding or script generation fails.
 */
function addressToP2PKHScriptPubKeyBuffer(address) {
    try {
        const { type, hash } = cashaddr.decode(address);
        if (type !== 'P2PKH') {
            // For now, we primarily handle P2PKH in most functions here.
            // If P2SH is needed elsewhere, adapt this or create a separate function.
            throw new Error(`Unsupported address type for P2PKH script generation: ${type}`);
        }
        // P2PKH script: OP_DUP OP_HASH160 <hash_len> <hash> OP_EQUALVERIFY OP_CHECKSIG
        // Opcodes:      0x76   0xa9     <len>      <hash> 0x88           0xac
        const hashBuffer = Buffer.from(hash); // cashaddr provides hash as Uint8Array, convert to Buffer
        return Buffer.concat([
            Buffer.from([0x76]), // OP_DUP
            Buffer.from([0xa9]), // OP_HASH160
            Buffer.from([hashBuffer.length]), // Push hash length (usually 20 bytes/0x14)
            hashBuffer,          // Push hash160
            Buffer.from([0x88]), // OP_EQUALVERIFY
            Buffer.from([0xac])  // OP_CHECKSIG
        ]);
    } catch (e) {
        logger.error(`BCHSERVICE: Error converting address ${address} to P2PKH scriptPubKey: ${e.message}`);
        throw e; // Re-throw
    }
}
// --- End Helper Function ---


// --- Wallet Functions ---

const generateAddress = async () => {
    // ... (generateAddress function remains unchanged) ...
    logger.info('BCHSERVICE: Generating new BCH address...');
    try {
        const lang = 'english'; // Or other supported language
        const mnemonic = bchjs.Mnemonic.generate(128, bchjs.Mnemonic.wordLists()[lang]);
        const rootSeedBuffer = await bchjs.Mnemonic.toSeed(mnemonic);
        const masterHDNode = bchjs.HDNode.fromSeed(rootSeedBuffer, network);
        const childNode = masterHDNode.derivePath(DEFAULT_DERIVATION_PATH);
        const address = bchjs.HDNode.toCashAddress(childNode);

        logger.info(`BCHSERVICE: Address generated successfully: ${address}`);
        return {
            mnemonic,
            address,
            derivationPath: DEFAULT_DERIVATION_PATH
        };
    } catch (error) {
        logger.error(`BCHSERVICE: Error during address generation: ${error.message}`);
        logger.error(error.stack);
        throw new Error(`Failed to generate BCH wallet details: ${error.message}`);
    }
};

function validateAddress(address) {
    // ... (validateAddress function remains unchanged) ...
    try {
        return bchjs.Address.isCashAddress(address) || bchjs.Address.isLegacyAddress(address);
    } catch (error) {
        logger.warn(`BCHSERVICE: Address validation error for "${address}": ${error.message}`);
        return false;
    }
}

/**
 * Gets the confirmed and unconfirmed balance for a given address using Electrum.
 * @param {string} address - The Bitcoin Cash address.
 * @returns {Promise<{balance: number, unconfirmedBalance: number}>} - Balance in BCH units.
 */
async function getBalance(address) {
    logger.debug(`BCHSERVICE: Getting balance for ${address}`);
    let client = null;
    try {
        client = await connectToElectrum();

        // --- Calculate script hash (CORRECTED using manual scriptPubKey) ---
        // 1. Generate P2PKH scriptPubKey buffer using the helper
        const scriptPubKey = addressToP2PKHScriptPubKeyBuffer(address);
        // 2. Calculate SHA256 hash of scriptPubKey
        const scriptHashBuffer = crypto.createHash('sha256').update(scriptPubKey).digest();
        // 3. Reverse bytes for Electrum protocol
        const scriptHash = Buffer.from(scriptHashBuffer.reverse()).toString('hex');
        // --- End script hash calculation ---

        const balanceResult = await client.request('blockchain.scripthash.get_balance', [scriptHash]);

        const confirmed = (balanceResult?.confirmed || 0) / SATOSHIS_PER_BCH;
        const unconfirmed = (balanceResult?.unconfirmed || 0) / SATOSHIS_PER_BCH;

        logger.debug(`BCHSERVICE: Balance for ${address}: Confirmed=${confirmed}, Unconfirmed=${unconfirmed}`);
        return {
            balance: confirmed,
            unconfirmedBalance: unconfirmed
        };
    } catch (error) {
        logger.error(`BCHSERVICE: Error getting balance for ${address}: ${error.message}`);
        if (error.stack) { logger.error(error.stack); }
        throw error; // Re-throw error
    } finally {
        if (client) {
            try { await client.close(); } catch { /* ignore close error */ }
        }
    }
}

async function derivePrivateKey(encryptedMnemonic, encryptedDerivationPath, encryptionKey) {
    // ... (derivePrivateKey function remains unchanged) ...
    logger.debug('BCHSERVICE: Deriving private key from encrypted data...');
    try {
        const mnemonic = cryptoUtils.decrypt(encryptedMnemonic, encryptionKey);
        const derivationPath = cryptoUtils.decrypt(encryptedDerivationPath, encryptionKey);

        const rootSeedBuffer = await bchjs.Mnemonic.toSeed(mnemonic);
        const masterHDNode = bchjs.HDNode.fromSeed(rootSeedBuffer, network);
        const childNode = masterHDNode.derivePath(derivationPath);
        const wif = bchjs.HDNode.toWIF(childNode);

        logger.debug('BCHSERVICE: Private key derived successfully.');
        console.log('Chave privada WIF derivada com sucesso (usando bchjs).'); // Keep existing log if needed
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
    // ... (connectToElectrum function remains unchanged) ...
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

/**
 * Calculates the Electrum script hash from a bchjs keyPair.
 * @param {object} keyPair - A keyPair object generated by bchjs.ECPair.fromWIF().
 * @returns {string} - The reversed SHA256 hash of the scriptPubKey, hex-encoded.
 */
function calculateScriptHashFromKeyPair(keyPair) {
    try {
        // Ensure publicKey buffer exists
        if (!keyPair || !keyPair.publicKey) {
            if (!keyPair.publicKey && keyPair.getPublicKeyBuffer) {
                 keyPair.publicKey = keyPair.getPublicKeyBuffer();
            } else if (!keyPair.publicKey) {
                 throw new Error("KeyPair lacks publicKey buffer and method to get it.");
            }
        }
        const publicKeyBuffer = keyPair.publicKey;
        logger.debug(`[Debug] Calculating script hash from publicKey: ${publicKeyBuffer.toString('hex')}`);

        // --- Construct P2PKH scriptPubKey using manual method ---
        const hash160 = bchjs.Crypto.hash160(publicKeyBuffer); // Get hash160 using bchjs
        const scriptPubKey = Buffer.concat([ // Manually build script
            Buffer.from([0x76]), Buffer.from([0xa9]), Buffer.from([hash160.length]), hash160,
            Buffer.from([0x88]), Buffer.from([0xac])
        ]);
        // --- End manual scriptPubKey construction ---
        logger.debug(`[Debug] ScriptPubKey P2PKH built (manual): ${scriptPubKey.toString('hex')}`);

        // Calculate SHA256 hash and reverse bytes for Electrum protocol
        const scriptHashBuffer = crypto.createHash('sha256').update(scriptPubKey).digest();
        const reversedScriptHash = Buffer.from(scriptHashBuffer.reverse()).toString('hex');
        logger.debug(`[Debug] Script hash calculated and inverted: ${reversedScriptHash}`);
        return reversedScriptHash;
    } catch (error) {
        logger.error(`Error in calculateScriptHashFromKeyPair: ${error.message}`);
        throw error;
    }
}


/**
 * Fetches UTXOs for a given keyPair/address using Electrum's listunspent.
 * Also fetches raw transaction data for each UTXO needed for signing.
 * @param {ElectrumClient} client - Connected Electrum client instance.
 * @param {object} keyPair - KeyPair object from bchjs.
 * @param {string} address - The user's BCH address.
 * @returns {Promise<Array<object>>} - Array of UTXO objects suitable for bchjs transaction builder, including raw hex.
 */
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

    // --- Get the scriptPubKey BUFFER once using the manual helper ---
    let scriptPubKeyBuffer = null; // <-- Changed variable name for clarity
    try {
        // Generate the buffer and keep it as a buffer
        scriptPubKeyBuffer = addressToP2PKHScriptPubKeyBuffer(address);
    } catch (scriptErr) {
         logger.error(`Failed to generate scriptPubKey for UTXOs of ${address}: ${scriptErr.message}`);
         throw new Error(`Failed to generate scriptPubKey for UTXOs: ${scriptErr.message}`);
    }
    // --- End scriptPubKey generation ---

    if (!scriptPubKeyBuffer) { // Add a check in case buffer generation failed silently
        throw new Error(`Failed to generate scriptPubKey Buffer for address ${address}`);
    }

    for (const utxo of utxosRaw) {
        logger.debug(`Processing UTXO: hash=${utxo.tx_hash}, index=${utxo.tx_pos}, value=${utxo.value}`);
        try {
            const txHex = await client.request('blockchain.transaction.get', [utxo.tx_hash]);
            utxos.push({
                txid: utxo.tx_hash,
                vout: utxo.tx_pos,
                amount: utxo.value / SATOSHIS_PER_BCH,
                satoshis: utxo.value,
                height: utxo.height,
                confirmations: utxo.height > 0 && currentHeight > 0 ? currentHeight - utxo.height + 1 : 0,
                scriptPubKey: scriptPubKeyBuffer, // <-- Store the BUFFER here
                txHex: txHex
            });
        } catch (hexError) {
            logger.error(`Failed to fetch raw transaction hex for UTXO ${utxo.tx_hash}: ${hexError.message}`);
        }
    }
    return utxos;
}


async function sendTransactionWithElectrum(fromWif, toAddress, amountBCH) {
    let client = null;
    logger.info(`Iniciando transação (Electrum/BCHJS) para ${toAddress}, Valor: ${amountBCH} BCH`);

    try {
        client = await connectToElectrum();
        logger.debug('Conectado ao servidor Electrum.');

        logger.debug(`[Debug] Deriving keyPair from WIF (via bchjs): ${fromWif.substring(0, 5)}...`);
        const keyPair = bchjs.ECPair.fromWIF(fromWif);
        // CORRECTED: Call getPublicKeyBuffer() on the keyPair instance
        if (!keyPair.publicKey && keyPair.getPublicKeyBuffer) { // Check if method exists
             keyPair.publicKey = keyPair.getPublicKeyBuffer();
        } else if (!keyPair.publicKey) {
             // If publicKey isn't set automatically and no method exists, something is wrong
             throw new Error("Failed to obtain public key buffer from WIF.");
        }
        // Now keyPair.publicKey should be the Buffer
        logger.debug('[Debug] keyPair derived successfully (via bchjs).');
        logger.debug(`[Debug] keyPair.publicKey (Buffer): ${keyPair.publicKey.toString('hex')}`); // Verify it's a buffer

        const fromAddress = bchjs.ECPair.toCashAddress(keyPair);
        logger.info(`Sender address (derived from bchjs): ${fromAddress}`);

        const utxos = await getUTXOsElectrumForKeyPair(client, keyPair, fromAddress); // Gets UTXOs with correct scriptPubKey
        if (!utxos || utxos.length === 0) {
            throw new Error('Insufficient balance (no UTXOs found).');
        }

        const transactionBuilder = new bchjs.TransactionBuilder(network);
        const sendAmountSatoshis = Math.round(amountBCH * SATOSHIS_PER_BCH);
        let totalInputSatoshis = 0;

        utxos.forEach(utxo => {
            transactionBuilder.addInput(utxo.txid, utxo.vout, transactionBuilder.DEFAULT_SEQUENCE, utxo.scriptPubKey);
            totalInputSatoshis += utxo.satoshis;
        });
        logger.debug(`Total inputs added: ${utxos.length}, Total value: ${totalInputSatoshis} satoshis`);

        const byteCount = bchjs.BitcoinCash.getByteCount({ P2PKH: utxos.length }, { P2PKH: 2 });
        const feeRate = 1.1; // TODO: Fetch dynamically
        const estimatedFeeSatoshis = Math.ceil(byteCount * feeRate);
        const feeSatoshis = estimatedFeeSatoshis;
        logger.warn(`!!! WARNING: Using estimated fee of ${feeSatoshis} satoshis (${feeRate} sat/byte). Consider fetching dynamic fee rate. !!!`);

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
            transactionBuilder.sign(
                index, keyPair, undefined, transactionBuilder.hashTypes.SIGHASH_ALL, utxo.satoshis
            );
            logger.debug(`Input ${index} (txid: ${utxo.txid.substring(0, 8)}...) signed.`);
        });

        logger.debug('Building final transaction...');
        const tx = transactionBuilder.build();
        const txHex = tx.toHex();
        logger.debug(`Transaction built (Electrum/BCHJS). Broadcasting...`);

        const txid = await client.request('blockchain.transaction.broadcast', [txHex]);
        logger.info(`Transaction broadcast successfully via Electrum. TXID: ${txid}`);
        return txid;

    } catch (error) {
        logger.error('--- ERROR CAPTURED IN sendTransactionWithElectrum ---');
        logger.error(`Message: ${error.message}`);
        // Log stack trace for detailed debugging
        if (error.stack) logger.error(`Stack Trace: ${error.stack}`);
        logger.error('--- END ERROR CAPTURED ---');
        // Re-throw a consistent error message
        throw new Error(`Error sending transaction (Electrum/BCHJS): ${error.message}`);
    } finally {
        if (client) {
            try { await client.close(); logger.debug('Electrum connection closed after send transaction.'); } catch { /* ignore */ }
        }
    }
}


/**
 * Fetches and processes transaction history live from Electrum for a given address.
 * @param {string} bchAddress - The Bitcoin Cash address.
 * @param {number} [limit=50] - Maximum number of transactions to fetch and process.
 * @returns {Promise<Array<object>>} - Array of formatted transaction objects.
 */
async function getTransactionHistoryFromElectrum(bchAddress, limit = 50) {
    logger.info(`BCHSERVICE: Fetching live history for ${bchAddress} (limit: ${limit})`);
    let client = null;
    const formattedTransactions = [];

    try {
        client = await connectToElectrum();

        // --- Calculate Script Hash (CORRECTED using manual scriptPubKey) ---
        let scriptHash;
        try {
            // 1. Generate P2PKH scriptPubKey buffer using the helper
            const outputScript = addressToP2PKHScriptPubKeyBuffer(bchAddress);
            // 2. Calculate SHA256 hash of scriptPubKey
            const scriptHashBuffer = crypto.createHash('sha256').update(outputScript).digest();
            // 3. Reverse bytes for Electrum protocol
            scriptHash = Buffer.from(scriptHashBuffer.reverse()).toString('hex');
        } catch (hashError) {
            logger.error(`BCHSERVICE: Error calculating script hash for ${bchAddress}: ${hashError.message}`);
            if (hashError.stack) { logger.error(hashError.stack); }
            throw new Error(`Failed to calculate script hash for history: ${hashError.message}`);
        }
        // --- End Script Hash Calculation ---

        const history = await client.request('blockchain.scripthash.get_history', [scriptHash]);
        logger.info(`BCHSERVICE: Found ${history?.length || 0} history items for ${bchAddress}.`);

        const relevantHistory = (history || []).reverse().slice(0, limit);

        const detailPromises = relevantHistory.map(item =>
            client.request('blockchain.transaction.get', [item.tx_hash, true])
                .catch(err => {
                    logger.error(`BCHSERVICE: Failed fetching details for ${item.tx_hash}: ${err.message}`);
                    return null;
                })
        );
        const transactionDetailsList = await Promise.all(detailPromises);

        relevantHistory.forEach((item, index) => {
            const txDetails = transactionDetailsList[index];
            if (!txDetails) return;

            let amountSatoshis = 0;
            let type = 'unknown';
            let receivedSatoshis = 0;

            for (const output of txDetails.vout) {
                if (output.scriptPubKey?.addresses?.includes(bchAddress)) {
                    receivedSatoshis += output.valueSat ?? Math.round((output.value || 0) * SATOSHIS_PER_BCH);
                }
            }

            if (receivedSatoshis > 0) {
                amountSatoshis = receivedSatoshis;
                type = 'received';
            } else {
                type = 'sent'; // Simplistic assumption
                amountSatoshis = 0;
            }

            formattedTransactions.push({
                _id: item.tx_hash, txid: item.tx_hash, type: type,
                amountSatoshis: amountSatoshis, amountBCH: amountSatoshis / SATOSHIS_PER_BCH,
                address: bchAddress,
                displayAddressLabel: type === 'received' ? 'Recebido' : 'Enviado/Movido',
                displayAddressValue: 'Detalhes na transação',
                timestamp: txDetails.blocktime ? new Date(txDetails.blocktime * 1000).toISOString() : new Date().toISOString(),
                status: item.height > 0 ? 'confirmed' : 'pending',
                blockHeight: item.height,
                confirmations: item.height > 0 && txDetails.confirmations ? txDetails.confirmations : 0,
                feeSatoshis: txDetails.fee ? Math.round(txDetails.fee * SATOSHIS_PER_BCH) : null,
            });
        });

        logger.info(`BCHSERVICE: Processed ${formattedTransactions.length} transactions for ${bchAddress}.`);
        return formattedTransactions;

    } catch (error) {
        logger.error(`BCHSERVICE: Error fetching live history for ${bchAddress}: ${error.message}`);
        if (error.stack) { logger.error(error.stack); }
        throw error;
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
    getTransactionHistoryFromElectrum,
    connectToElectrum,
    // addressToP2PKHScriptPubKeyBuffer // Keep internal unless needed elsewhere
  };
// --- End Module Exports ---
