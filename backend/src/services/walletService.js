// z:\Kashy-Project\backend\src\services\walletService.js

// Use CommonJS require syntax
require('dotenv').config();
const bitcore = require('bitcore-lib-cash');
const config = require('../config');
const { getBchToBrlRate } = require('./exchangeRate');
const logger = require('../utils/logger');
const electrumRequestManager = require('./electrumRequestManager');
const BCHJS = require('@psf/bch-js');
const cryptoUtils = require('../utils/cryptoUtils');
const crypto = require('crypto'); // Needed for addressToScriptHash
const cashaddr = require('cashaddrjs'); // Needed for addressToScriptHash
const cache = require('./cacheService'); // Cache service
const User = require('../models/user');
const Order = require('../models/Order'); // Import Order model
const UserOrderIndex = require('../models/UserOrderIndex');

// --- Constants and Global Initializations ---
const SATOSHIS_PER_BCH = 100_000_000;
const DUST_THRESHOLD = 546; // Dust threshold in satoshis

// --- Cache TTLs (in seconds) ---
const CACHE_TTL_BALANCE = 30; // Cache balance for 30 seconds
const CACHE_TTL_HEIGHT = 15; // Cache block height for 15 seconds
const CACHE_TTL_HISTORY = 120; // Cache processed history for 2 minutes (Requires Invalidation!)
const CACHE_TTL_TX_DETAIL_CONFIRMED = 3600 * 24; // Cache confirmed transaction details for 24 hours
const CACHE_TTL_TX_DETAIL_UNCONFIRMED = 120; // Cache unconfirmed transaction details for 120 seconds (Increased)

// --- Initialize bch-js ---
const bchjsOptions = {};
const network = config.network === 'testnet' ? 'testnet' : 'mainnet'; // Define network for bchjs and validation

if (network === 'testnet' && process.env.BCH_TESTNET_API) {
    bchjsOptions.restURL = process.env.BCH_TESTNET_API;
} else if (network === 'mainnet' && process.env.BCH_MAINNET_API) {
    bchjsOptions.restURL = process.env.BCH_MAINNET_API;
} else {
    bchjsOptions.restURL = 'https://api.mainnet.cash'; // Default if not set
}
const bchjs = new BCHJS(bchjsOptions);
// --- End Global Initializations ---

/**
 * Deriva um endereço BCH único para fatura de um comerciante.
 * @param {string} encryptedMnemonic - Seed criptografada do comerciante.
 * @param {string} encryptedBasePath - Caminho base criptografado (ex: m/44'/145'/0'/0).
 * @param {string} encryptionKey - Chave para descriptografar.
 * @param {number} invoiceIndex - Índice sequencial para a fatura.
 * @returns {Promise<{address: string, invoicePath: string}>} Endereço BCH derivado e seu caminho.
 */
async function deriveInvoiceAddress(encryptedMnemonic, encryptedBasePath, encryptionKey, invoiceIndex) {
  // 1. Descriptografa seed e caminho base
  const mnemonic = cryptoUtils.decrypt(encryptedMnemonic, encryptionKey);
  const basePath = cryptoUtils.decrypt(encryptedBasePath, encryptionKey); // ex: m/44'/145'/0'/0

  // 2. Monta caminho completo para fatura (ex: .../1/{invoiceIndex})
  const invoicePath = `${basePath}/1/${invoiceIndex}`;

  // 3. Deriva HDNode e endereço
  const rootSeedBuffer = await bchjs.Mnemonic.toSeed(mnemonic);
  const masterHDNode = bchjs.HDNode.fromSeed(rootSeedBuffer, network);
  const childNode = masterHDNode.derivePath(invoicePath);
  const address = bchjs.HDNode.toCashAddress(childNode);

  return { address, invoicePath };
}

// --- Wallet Derivation/Loading (MODIFIED FOR SECURE RETRIEVAL) ---
async function getUserWalletKeys(userId) {
    logger.debug(`[WalletKeys] Fetching keys for user: ${userId}`);
    const encryptionKey = process.env.ENCRYPTION_KEY; // Get encryption key from environment
    if (!encryptionKey) {
        logger.error(`[WalletKeys] FATAL - ENCRYPTION_KEY is not set.`);
        // Throw a generic error to the caller, but log the specific issue
        throw new Error("Server configuration error preventing key access.");
    }

    try {
        // 1. Fetch the user from the database including encrypted data
        const user = await User.findById(userId).select('+encryptedMnemonic +encryptedDerivationPath +bchAddress'); // Select sensitive fields + address
        if (!user) {
            logger.error(`[WalletKeys] User not found: ${userId}`);
            throw new Error('User not found.');
        }
        if (!user.encryptedMnemonic || !user.encryptedDerivationPath) {
            logger.error(`[WalletKeys] User ${userId} is missing encrypted wallet data.`);
            throw new Error('Encrypted wallet data not found for user.');
        }

        // 2. Decrypt the mnemonic and derivation path
        const mnemonic = cryptoUtils.decrypt(user.encryptedMnemonic, encryptionKey);
        const derivationPath = cryptoUtils.decrypt(user.encryptedDerivationPath, encryptionKey);

        // 3. Derive the keys using bchjs (ensure 'network' is defined correctly, it is near the top)
        const rootSeedBuffer = await bchjs.Mnemonic.toSeed(mnemonic);
        const masterHDNode = bchjs.HDNode.fromSeed(rootSeedBuffer, network);
        const childNode = masterHDNode.derivePath(derivationPath);
        const wif = bchjs.HDNode.toWIF(childNode);
        const address = bchjs.HDNode.toCashAddress(childNode);

        // 4. Verify derived address matches stored address (optional but recommended)
        if (user.bchAddress && user.bchAddress !== address) {
             logger.error(`[WalletKeys] CRITICAL MISMATCH for user ${userId}: Stored address ${user.bchAddress} != Derived address ${address}`);
             // This is a serious issue, prevent further action
             throw new Error("Wallet data inconsistency detected. Please contact support.");
        } else if (!user.bchAddress) {
             logger.warn(`[WalletKeys] User ${userId} was missing bchAddress in DB. Derived: ${address}. Consider updating the user document.`);
             // Optionally update the user document here if desired
             // await User.updateOne({ _id: userId }, { $set: { bchAddress: address } });
        }

        logger.debug(`[WalletKeys] Successfully derived keys for user ${userId}`);
        return {
            wif: wif,
            address: address, // Return the derived (and verified) address
            // For fetching all user addresses later:
            mnemonic: mnemonic, // Return decrypted mnemonic for deriving other addresses
            baseDerivationPath: derivationPath.substring(0, derivationPath.lastIndexOf('/')), // e.g. m/44'/145'/0'/0
        };
    } catch (error) {
        logger.error(`[WalletKeys] Failed to get/derive keys for user ${userId}: ${error.message}`);
        if (error.message === 'User not found.' || error.message.includes('inconsistency')) {
            throw error;
        }
        throw new Error(`Failed to access or derive wallet keys.`);
    }
}
// --- END MODIFIED FUNCTION ---


// --- Helper: Address to ScriptHash (Keep as is) ---
function addressToScriptHash(address) {
    try {
        const { type, hash } = cashaddr.decode(address);
        let script;
        if (type === 'P2PKH') {
            script = Buffer.concat([ Buffer.from([0x76]), Buffer.from([0xa9]), Buffer.from([hash.length]), Buffer.from(hash), Buffer.from([0x88]), Buffer.from([0xac]) ]);
        } else if (type === 'P2SH') {
             script = Buffer.concat([ Buffer.from([0xa9]), Buffer.from([hash.length]), Buffer.from(hash), Buffer.from([0x87]) ]);
        } else { throw new Error(`Unsupported address type: ${type}`); }

        const scriptHashBuffer = crypto.createHash('sha256').update(script).digest();
        return Buffer.from(scriptHashBuffer.reverse()).toString('hex');
    } catch (e) {
        logger.error(`Error converting address ${address} to script hash: ${e.message}`);
        throw e;
    }
}

// --- Helper: Get all relevant addresses for a user (main + active/paid invoices) ---
async function getAllUserControlledAddresses(userId) {
    const userWalletInfo = await getUserWalletKeys(userId); // Gets main address
    const mainAddress = userWalletInfo.address;
    const addresses = new Set([mainAddress]);

    // Fetch invoice addresses
    const relevantOrders = await Order.find({
        user: userId,
        paymentMethod: 'bch',
        merchantAddress: { $exists: true, $ne: null },
        // Consider which statuses mean an address might still hold funds or is relevant for history
        status: { $in: ['pending', 'payment_detected', 'paid', 'confirmed_paid'] }
    }).select('merchantAddress').lean();

    relevantOrders.forEach(order => {
        if (order.merchantAddress) {
            addresses.add(order.merchantAddress);
        }
    });
    logger.debug(`[getAllUserControlledAddresses] User ${userId} controls addresses: ${Array.from(addresses).join(', ')}`);
    return Array.from(addresses);
}


// --- Service Functions (Using electrumRequestManager AND Cache) ---

async function getWalletAddress(userId) {
    const keys = await getUserWalletKeys(userId);
    return keys.address;
}

async function getWalletBalance(userId) {
    const cacheKey = `balance:${userId}`;
    logger.debug(`[Balance] Checking cache for key: ${cacheKey}`);
    const cachedBalance = cache.get(cacheKey);
    if (cachedBalance !== undefined) {
        logger.debug(`[Balance] Cache HIT for ${userId}. Returning cached data.`);
        return cachedBalance;
    }

    logger.debug(`[Balance] Cache MISS for ${userId}. Fetching fresh balance for all controlled addresses...`);

    const userControlledAddresses = await getAllUserControlledAddresses(userId);
    if (userControlledAddresses.length === 0) {
        logger.warn(`[Balance] No addresses found for user ${userId}. Returning zero balance.`);
        const zeroBalance = { totalBCH: 0, availableBCH: 0, pendingBCH: 0, totalBRL: 0, totalSatoshis: 0, currentRateBRL: await getBchToBrlRate() };
        cache.set(cacheKey, zeroBalance, CACHE_TTL_BALANCE);
        return zeroBalance;
    }

    const rate = await getBchToBrlRate();
    let totalConfirmedSatoshis = 0;
    let totalUnconfirmedSatoshis = 0;

    const balancePromises = userControlledAddresses.map(async (address) => {
        try {
            const scriptHash = addressToScriptHash(address);
            const balanceResult = await electrumRequestManager.raceRequest(
                'blockchain.scripthash.get_balance',
                [scriptHash]
            );
            return {
                confirmed: balanceResult?.confirmed || 0,
                unconfirmed: balanceResult?.unconfirmed || 0,
            };
        } catch (error) {
            logger.error(`[Balance] Error fetching balance for address ${address} (User ${userId}): ${error.message}`);
            return { confirmed: 0, unconfirmed: 0 }; // Return 0 on error for this address
        }
    });

    const individualBalances = await Promise.all(balancePromises);

    individualBalances.forEach(bal => {
        totalConfirmedSatoshis += bal.confirmed;
        totalUnconfirmedSatoshis += bal.unconfirmed;
    });

    logger.debug(`[Balance] Total Satoshis for User ${userId}: Confirmed=${totalConfirmedSatoshis}, Unconfirmed=${totalUnconfirmedSatoshis}`);

    const totalSatoshis = totalConfirmedSatoshis + totalUnconfirmedSatoshis;
    const availableBCH = totalConfirmedSatoshis / SATOSHIS_PER_BCH;
    const pendingBCH = totalUnconfirmedSatoshis / SATOSHIS_PER_BCH;
    const totalBCH = totalSatoshis / SATOSHIS_PER_BCH;
    const totalBRL = totalBCH * rate;

    const balanceData = {
        totalBCH,
        availableBCH,
        pendingBCH,
        totalBRL,
        totalSatoshis,
        currentRateBRL: rate,
    };
    logger.info(`[Balance] Calculated aggregated balanceData for ${userId}: ${JSON.stringify(balanceData)}`);

    logger.debug(`[Balance] Setting cache for key: ${cacheKey}`);
    cache.set(cacheKey, balanceData, CACHE_TTL_BALANCE);
    return balanceData;
}

async function getBlockHeight() {
    const cacheKey = 'blockHeight';
    const cachedHeight = cache.get(cacheKey);
    if (cachedHeight !== undefined) {
        return cachedHeight;
    }

    logger.debug(`[Block Height] Fetching current block height via racing - Cache MISS`);
    try {
        const headerResult = await electrumRequestManager.raceRequest(
            'blockchain.headers.subscribe',
            []
        );
        const height = headerResult?.height || 0;
        logger.debug(`[Block Height] Current height: ${height}`);
        if (height > 0) {
             cache.set(cacheKey, height, CACHE_TTL_HEIGHT);
        }
        return height;
    } catch (error) {
        logger.error(`[Block Height] Failed to get block height via racing: ${error.message}`);
        throw new Error(`Failed to get current block height: ${error.message}`);
    }
}

async function getWalletTransactions(userId) {
    const historyCacheKey = `history:${userId}`;
    logger.debug(`[History] Checking processed history cache for key: ${historyCacheKey}`);
    const cachedHistory = cache.get(historyCacheKey);
    if (cachedHistory !== undefined) {
        logger.debug(`[History] Processed history Cache HIT for ${userId}. Returning cached list.`);
        return cachedHistory;
    }

    logger.debug(`[History] Processed history Cache MISS for ${userId}. Fetching fresh history for all controlled addresses...`);

    const userControlledAddresses = await getAllUserControlledAddresses(userId);
    if (userControlledAddresses.length === 0) {
        logger.warn(`[History] No addresses found for user ${userId}. Returning empty history.`);
        cache.set(historyCacheKey, [], CACHE_TTL_HISTORY);
        return [];
    }

    let rate = 0;
    let currentHeight = 0;
    const allTxDetailsMap = new Map(); // Store unique tx details by txid
    const allPrevOutputsMap = new Map(); // Store unique prevout details by "txid:vout"

    try {
        [rate, currentHeight] = await Promise.all([
            getBchToBrlRate(),
            getBlockHeight()
        ]);
        logger.debug(`[History] Current Rate: ${rate}, Current Height: ${currentHeight}`);

        // --- Helper to fetch and cache TX details ---
        const getTxDetailWithCache = async (txid, historyItemHeight, currentBlockHeightParam) => {
            const txCacheKey = `tx:${txid}`;
            const cachedTx = cache.get(txCacheKey);
            if (cachedTx !== undefined) return cachedTx;

            logger.debug(`[History Detail Cache] Tx detail Cache MISS for ${txid}. Fetching details...`);
            try {
                const txDetail = await electrumRequestManager.raceRequest('blockchain.transaction.get', [txid, true]);
                if (txDetail) {
                    const blockheight = txDetail.blockheight || (historyItemHeight > 0 ? historyItemHeight : null);
                    const confirmations = blockheight && currentBlockHeightParam > 0 ? currentBlockHeightParam - blockheight + 1 : 0;
                    const ttl = confirmations > 0 ? CACHE_TTL_TX_DETAIL_CONFIRMED : CACHE_TTL_TX_DETAIL_UNCONFIRMED;
                    cache.set(txCacheKey, txDetail, ttl);
                } else {
                    logger.warn(`[History Detail] Received null/empty detail for ${txid} from Electrum.`);
                }
                return txDetail;
            } catch (err) {
                 logger.error(`[History Detail] Failed fetching/caching details for ${txid}: ${err.message}`);
                 return null;
            }
        };

        // 1. Fetch history for all controlled addresses and collect unique tx_hashes
        const uniqueTxHashesFromHistories = new Set();
        const addressHistories = new Map(); // Store raw history per address for height reference

        for (const address of userControlledAddresses) {
            const scriptHash = addressToScriptHash(address);
            logger.debug(`[History] Fetching raw history for ${address} (SH: ${scriptHash})`);
            const history = await electrumRequestManager.raceRequest('blockchain.scripthash.get_history', [scriptHash]);
            addressHistories.set(address, history || []);
            if (history && history.length > 0) {
                history.forEach(item => uniqueTxHashesFromHistories.add(item.tx_hash));
            }
        }
        logger.debug(`[History] Found ${uniqueTxHashesFromHistories.size} unique transaction hashes across all addresses.`);

        // 2. Fetch details for all unique transactions
        const txDetailPromises = Array.from(uniqueTxHashesFromHistories).map(txHash => {
            // Find a history item for this tx_hash to get a height hint (can be from any address history)
            let heightHint = 0;
            for (const hist of addressHistories.values()) {
                const item = hist.find(h => h.tx_hash === txHash);
                if (item && item.height > 0) {
                    heightHint = item.height;
                    break;
                }
            }
            return getTxDetailWithCache(txHash, heightHint, currentHeight);
        });

        const fetchedTxDetailsList = await Promise.all(txDetailPromises);
        fetchedTxDetailsList.forEach(detail => {
            if (detail && detail.txid) {
                allTxDetailsMap.set(detail.txid, detail);
            }
        });
        logger.debug(`[History] Fetched/retrieved details for ${allTxDetailsMap.size} unique transactions.`);

        // 3. Fetch previous output details for all inputs in these transactions
        const neededPrevOutputsKeys = new Set();
        allTxDetailsMap.forEach(txDetails => {
            txDetails.vin.forEach(vin => {
                if (vin.coinbase || !vin.txid || vin.vout === undefined) return;
                neededPrevOutputsKeys.add(`${vin.txid}:${vin.vout}`);
            });
        });

        if (neededPrevOutputsKeys.size > 0) {
            logger.debug(`[History] Need details for ${neededPrevOutputsKeys.size} unique previous outputs. Fetching...`);
            const uniquePrevTxids = new Set(Array.from(neededPrevOutputsKeys).map(key => key.split(':')[0]));
            const prevTxDetailPromises = Array.from(uniquePrevTxids).map(txid => getTxDetailWithCache(txid, 0, currentHeight)); // Height hint 0 for prev txs
            const prevTransactionDetailsList = await Promise.all(prevTxDetailPromises);
            const prevTxDetailsMapForLookup = new Map(prevTransactionDetailsList.filter(d => d).map(d => [d.txid, d]));

            neededPrevOutputsKeys.forEach(key => {
                const [txid, voutStr] = key.split(':');
                const voutIndex = parseInt(voutStr, 10);
                const prevTx = prevTxDetailsMapForLookup.get(txid);
                if (prevTx && prevTx.vout && prevTx.vout[voutIndex]) {
                    allPrevOutputsMap.set(key, prevTx.vout[voutIndex]);
                } else {
                     logger.warn(`[History Prev Detail] Could not find or access vout ${voutIndex} for prev tx ${txid}`);
                }
            });
            logger.debug(`[History] Successfully fetched/retrieved and mapped details for ${allPrevOutputsMap.size} previous outputs.`);
        }

        // 4. Process and Classify Transactions
        const processedTxs = [];
        allTxDetailsMap.forEach(txDetails => {
            try {
                const txid = txDetails.txid;
                // Find the original history item for this txid to get the most relevant height for confirmations
                // This is a simplification; a tx can appear in multiple address histories with different heights if unconfirmed
                let primaryHistoryItemHeight = 0;
                for (const hist of addressHistories.values()) {
                    const item = hist.find(h => h.tx_hash === txid);
                    if (item && item.height > 0) {
                        primaryHistoryItemHeight = item.height;
                        break;
                    }
                }
                if (primaryHistoryItemHeight === 0 && txDetails.blockheight) { // Fallback to txDetail's blockheight
                    primaryHistoryItemHeight = txDetails.blockheight;
                }

                const blockHeight = primaryHistoryItemHeight > 0 ? primaryHistoryItemHeight : undefined;
                const confirmations = blockHeight && currentHeight > 0 ? currentHeight - blockHeight + 1 : 0;
                const status = confirmations > 0 ? 'confirmed' : 'pending';
                const timestamp = txDetails.blocktime ? new Date(txDetails.blocktime * 1000).toISOString() : (txDetails.time ? new Date(txDetails.time * 1000).toISOString() : new Date().toISOString());
                const feeSatoshis = txDetails.fees ? Math.round(txDetails.fees * SATOSHIS_PER_BCH) : 0;

                let totalInputFromUserControlled = 0;
                let totalOutputToUserControlled = 0;
                let totalOutputToExternal = 0;
                let firstExternalRecipient = null;

                // Analyze Inputs
                for (const vin of txDetails.vin) {
                    if (vin.coinbase || !vin.txid || vin.vout === undefined) continue;
                    const key = `${vin.txid}:${vin.vout}`;
                    const prevOutputDetail = allPrevOutputsMap.get(key);
                    if (prevOutputDetail) {
                        const inputValueSat = prevOutputDetail.valueSat ?? Math.round((prevOutputDetail.value || 0) * SATOSHIS_PER_BCH);
                        const prevAddr = prevOutputDetail.scriptPubKey?.addresses?.[0];
                        if (prevAddr && userControlledAddresses.includes(prevAddr)) {
                            totalInputFromUserControlled += inputValueSat;
                        }
                    } else {
                        logger.error(`[History Process - Input] CRITICAL: Missing prev output detail for ${key} in tx ${txid}.`);
                    }
                }

                // Analyze Outputs
                for (const vout of txDetails.vout) {
                    const outputValueSat = vout.valueSat ?? Math.round((vout.value || 0) * SATOSHIS_PER_BCH);
                    const outputAddr = vout.scriptPubKey?.addresses?.[0];
                    if (outputAddr && userControlledAddresses.includes(outputAddr)) {
                        totalOutputToUserControlled += outputValueSat;
                    } else if (outputAddr) { // Output to an external address
                        totalOutputToExternal += outputValueSat;
                        firstExternalRecipient = firstExternalRecipient || outputAddr;
                    }
                }

                let type = 'unknown';
                let amountSatoshis = 0;
                let displayAddress = 'N/A';

                if (totalInputFromUserControlled > 0 && totalOutputToExternal > 0) {
                    type = 'sent';
                    // For 'sent', amount is what left the user's control to external addresses
                    amountSatoshis = totalOutputToExternal; // Fee is implicitly covered by inputs
                    displayAddress = firstExternalRecipient || 'Multiple Recipients';
                } else if (totalInputFromUserControlled === 0 && totalOutputToUserControlled > 0) {
                    type = 'received';
                    amountSatoshis = totalOutputToUserControlled;
                    // For received, display one of the user's addresses that received it.
                    // Find the first user-controlled address in vout.
                    const receivingVout = txDetails.vout.find(v => v.scriptPubKey?.addresses?.some(a => userControlledAddresses.includes(a)));
                    displayAddress = receivingVout?.scriptPubKey?.addresses?.[0] || userControlledAddresses[0];
                } else if (totalInputFromUserControlled > 0 && totalOutputToExternal === 0 && totalOutputToUserControlled > 0) {
                    // This is a self-transfer (e.g., consolidation, or change from a more complex send not fully captured)
                    // The "amount" could be the fee, or net change if inputs > outputs to self
                    type = 'self';
                    amountSatoshis = feeSatoshis; // Consider fee as the "cost" of this self-transaction
                    displayAddress = userControlledAddresses[0]; // Display one of the user's addresses
                } else {
                    logger.warn(`[History Process] Complex/Unknown TX ${txid}. InputsFromUser: ${totalInputFromUserControlled}, OutputsToUser: ${totalOutputToUserControlled}, OutputsToExternal: ${totalOutputToExternal}`);
                    // If it's an output to user but no user inputs, it's likely a simple receive not caught above.
                    if (totalOutputToUserControlled > 0 && totalInputFromUserControlled === 0) {
                        type = 'received';
                        amountSatoshis = totalOutputToUserControlled;
                        const receivingVout = txDetails.vout.find(v => v.scriptPubKey?.addresses?.some(a => userControlledAddresses.includes(a)));
                        displayAddress = receivingVout?.scriptPubKey?.addresses?.[0] || userControlledAddresses[0];
                    } else {
                        amountSatoshis = 0; // Default for truly unknown
                    }
                }
                logger.debug(`[TX Classify - Result] TXID: ${txid} - Classified as ${type}. Amount: ${amountSatoshis} sats. DisplayAddr: ${displayAddress}`);

                if (amountSatoshis < 0) amountSatoshis = 0;
                const amountBCH = amountSatoshis / SATOSHIS_PER_BCH;
                const amountBRL = amountBCH * rate;
                const feeBCH = (type === 'sent' || type === 'self') ? (feeSatoshis / SATOSHIS_PER_BCH) : undefined;

                processedTxs.push({
                    _id: txid, type, amountBCH, amountBRL, address: displayAddress, txid,
                    timestamp, status, confirmations, blockHeight, fee: feeBCH,
                });

            } catch (procError) {
                 logger.error(`[History Process] Error processing tx ${txDetails?.txid || 'unknown_txid'}: ${procError.message}`, procError.stack);
            }
        });

        processedTxs.sort((a, b) => (new Date(b.timestamp).getTime()) - (new Date(a.timestamp).getTime()));
        logger.info(`[History] Successfully processed ${processedTxs.length} transactions for user ${userId}.`);
        cache.set(historyCacheKey, processedTxs, CACHE_TTL_HISTORY);
        return processedTxs;

    } catch (error) {
        logger.error(`[History] Top-level error fetching/processing history for user ${userId}: ${error.message}`, error.stack);
        throw new Error(`Failed to fetch transaction history. Please try again later.`);
    }
}

async function sendTransaction(userId, recipientAddress, amountBchStr, feeLevel) {
    try {
        const result = await sendTransactionInternal(userId, recipientAddress, amountBchStr, feeLevel);
        logger.info(`[Send TX Success] Invalidating cache for user ${userId} after sending ${result.txid}`);
        cache.invalidateUserWalletCache(userId);
        cache.invalidateBlockHeightCache();
        return result;
    } catch (error) {
         logger.error(`[Send TX Failure] Error during send transaction: ${error.message}`);
         throw error;
    }
}

async function sendTransactionInternal(userId, recipientAddress, amountBchStr, feeLevel) {
    // This function now spends ONLY from the user's main address.
    // To spend from multiple addresses (main + invoices), UTXO collection needs to be expanded.
    const keys = await getUserWalletKeys(userId); // Gets WIF and address for the MAIN user address
    const fromAddress = keys.address;
    const wif = keys.wif;
    const amountBCH = parseFloat(amountBchStr);

    logger.info(`[Send TX Internal] User: ${userId}, From (Main Addr): ${fromAddress}, To: ${recipientAddress}, Amount: ${amountBchStr} BCH, FeeLevel: ${feeLevel}`);

    if (isNaN(amountBCH) || amountBCH <= 0) { throw new Error('Invalid amount specified.'); }
    if (!bitcore.Address.isValid(recipientAddress, network)) { throw new Error('Invalid recipient address.'); }
    const amountSatoshis = Math.round(amountBCH * SATOSHIS_PER_BCH);
    if (amountSatoshis < DUST_THRESHOLD) { throw new Error(`Amount ${amountSatoshis} is below dust threshold ${DUST_THRESHOLD}`); }

    let feeRateSatsPerByte;
    switch (feeLevel) {
      case 'low': feeRateSatsPerByte = 1.0; break;
      case 'high': feeRateSatsPerByte = 1.5; break;
      case 'medium': default: feeRateSatsPerByte = 1.1; break;
    }
    logger.info(`[Send TX Internal] Using fee rate: ${feeRateSatsPerByte} sats/byte for level '${feeLevel}'`);

    try {
        const scriptHash = addressToScriptHash(fromAddress); // Script hash of the main address
        logger.debug(`[Send TX Internal] Fetching UTXOs for main address ${fromAddress} (SH: ${scriptHash})`);
        const utxosRaw = await electrumRequestManager.raceRequest('blockchain.scripthash.listunspent', [scriptHash]);

        if (!utxosRaw || utxosRaw.length === 0) {
            logger.warn(`[Send TX Internal] No UTXOs found for main address ${fromAddress}.`);
            throw new Error('Insufficient funds (no UTXOs found on main address).');
        }
        const utxos = utxosRaw.map(utxo => ({ txid: utxo.tx_hash, vout: utxo.tx_pos, satoshis: utxo.value }));

        const transactionBuilder = new bchjs.TransactionBuilder(network);
        let totalInputSatoshis = 0;
        utxos.forEach(utxo => {
            transactionBuilder.addInput(utxo.txid, utxo.vout);
            totalInputSatoshis += utxo.satoshis;
        });

        const preliminaryOutputCount = 2;
        const byteCountEstimate = bchjs.BitcoinCash.getByteCount({ P2PKH: utxos.length }, { P2PKH: preliminaryOutputCount });
        const feeEstimate = Math.ceil(byteCountEstimate * feeRateSatsPerByte);
        const changeAmountEstimate = totalInputSatoshis - amountSatoshis - feeEstimate;
        const needsChangeOutput = changeAmountEstimate >= DUST_THRESHOLD;
        const finalOutputCount = needsChangeOutput ? 2 : 1;
        const finalByteCount = bchjs.BitcoinCash.getByteCount({ P2PKH: utxos.length }, { P2PKH: finalOutputCount });
        const feeSatoshis = Math.ceil(finalByteCount * feeRateSatsPerByte);

        if (totalInputSatoshis < amountSatoshis + feeSatoshis) {
            throw new Error(`Insufficient funds. Required: ${amountSatoshis + feeSatoshis} satoshis, Available: ${totalInputSatoshis} satoshis.`);
        }

        transactionBuilder.addOutput(recipientAddress, amountSatoshis);
        const changeAmountSatoshis = totalInputSatoshis - amountSatoshis - feeSatoshis;
        if (needsChangeOutput) {
            transactionBuilder.addOutput(fromAddress, changeAmountSatoshis);
        }

        const keyPair = bchjs.ECPair.fromWIF(wif);
        utxos.forEach((utxo, index) => {
            transactionBuilder.sign(index, keyPair, undefined, transactionBuilder.hashTypes.SIGHASH_ALL, utxo.satoshis);
        });

        const tx = transactionBuilder.build();
        const txHex = tx.toHex();
        const txid = await electrumRequestManager.raceRequest('blockchain.transaction.broadcast', [txHex]);

        if (!txid || typeof txid !== 'string' || txid.length < 64) {
             throw new Error('Transaction broadcast may have failed or succeeded without confirmation.');
        }
        logger.info(`[Send TX Internal] Transaction sent successfully from main address. Txid: ${txid}`);
        return { txid };

    } catch (error) {
        logger.error(`[Send TX Internal] Error: ${error.message}`, error.stack);
        if (error.message.includes('Insufficient funds')) throw new Error('Insufficient funds to cover the amount and transaction fee.');
        if (error.message.includes('Invalid recipient address')) throw new Error('Invalid recipient address.');
        if (error.message.includes('below dust threshold')) throw new Error('Transaction amount is too small (below dust threshold).');
        if (error.message.includes('Invalid amount')) throw new Error('Invalid amount specified.');
        if (error.message.includes('timeout') || error.message.includes('No connected Electrum servers')) throw new Error('Network error during transaction broadcast.');
        throw new Error(`Failed to send transaction: ${error.message}`);
    }
}

module.exports = {
    getWalletAddress,
    getWalletBalance,
    getWalletTransactions,
    sendTransaction,
    deriveInvoiceAddress,
    // getUserWalletKeys, // Keep internal unless needed by other services directly
};
