// z:\Kashy-Project\backend\src\services\walletService.js

// Use CommonJS require syntax
require('dotenv').config();
const bitcore = require('bitcore-lib-cash');
const config = require('../config');
const { getBchToBrlRate } = require('./exchangeRate');
const logger = require('../utils/logger');
// Import the request manager for ALL electrum communication
const electrumRequestManager = require('./electrumRequestManager');
// Import bchjs for transaction building/signing
const BCHJS = require('@psf/bch-js');
const crypto = require('crypto'); // Needed for addressToScriptHash
const cashaddr = require('cashaddrjs'); // Needed for addressToScriptHash
const cache = require('./cacheService'); // Cache service
// --- MODIFICATION: Add User model and cryptoUtils ---
const User = require('../models/user');
const cryptoUtils = require('../utils/cryptoUtils');
// --- END MODIFICATION ---

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
            // keyPair: childNode, // bchjs HDNode can often be used directly where ECPair was, but sendTx uses WIF
            address: address, // Return the derived (and verified) address
        };
    } catch (error) {
        logger.error(`[WalletKeys] Failed to get/derive keys for user ${userId}: ${error.message}`);
        // Avoid leaking sensitive details in the thrown error message if possible
        // Rethrow specific known errors, otherwise a generic one
        if (error.message === 'User not found.' || error.message.includes('inconsistency')) {
            throw error;
        }
        throw new Error(`Failed to access or derive wallet keys.`); // Generic error for other issues
    }
}
// --- END MODIFIED FUNCTION ---


// --- Helper: Address to ScriptHash (Keep as is) ---
function addressToScriptHash(address) {
    try {
        const { type, hash } = cashaddr.decode(address);
        let script;
        if (type === 'P2PKH') {
            // OP_DUP OP_HASH160 <pubKeyHash> OP_EQUALVERIFY OP_CHECKSIG
            script = Buffer.concat([ Buffer.from([0x76]), Buffer.from([0xa9]), Buffer.from([hash.length]), Buffer.from(hash), Buffer.from([0x88]), Buffer.from([0xac]) ]);
        } else if (type === 'P2SH') {
            // OP_HASH160 <scriptHash> OP_EQUAL
             script = Buffer.concat([ Buffer.from([0xa9]), Buffer.from([hash.length]), Buffer.from(hash), Buffer.from([0x87]) ]);
        } else { throw new Error(`Unsupported address type: ${type}`); }

        const scriptHashBuffer = crypto.createHash('sha256').update(script).digest();
        return Buffer.from(scriptHashBuffer.reverse()).toString('hex');
    } catch (e) {
        logger.error(`Error converting address ${address} to script hash: ${e.message}`);
        throw e; // Re-throw to be caught by calling function
    }
}


// --- Service Functions (Using electrumRequestManager AND Cache) ---

async function getWalletAddress(userId) {
    // No caching needed here, just key derivation
    const keys = await getUserWalletKeys(userId); // Now uses the secure method
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

    logger.debug(`[Balance] Cache MISS for ${userId}. Fetching fresh balance...`);

    // Use the secure key retrieval
    const keys = await getUserWalletKeys(userId);
    const scriptHash = addressToScriptHash(keys.address); // Use derived address
    logger.debug(`[Balance] User: ${userId}, Address: ${keys.address}, ScriptHash: ${scriptHash}`);

    const rate = await getBchToBrlRate(); // Rate is cached in its own service

    try {
        logger.debug(`[Balance] Calling raceRequest('blockchain.scripthash.get_balance', ['${scriptHash}'])`);
        const balanceResult = await electrumRequestManager.raceRequest(
            'blockchain.scripthash.get_balance',
            [scriptHash]
        );
        logger.debug(`[Balance] Raw balanceResult from Electrum for ${scriptHash}: ${JSON.stringify(balanceResult)}`);

        const confirmedSatoshis = balanceResult?.confirmed || 0;
        const unconfirmedSatoshis = balanceResult?.unconfirmed || 0;
        logger.debug(`[Balance] Parsed Satoshis: Confirmed=${confirmedSatoshis}, Unconfirmed=${unconfirmedSatoshis}`);

        const totalSatoshis = confirmedSatoshis + unconfirmedSatoshis;
        const availableBCH = confirmedSatoshis / SATOSHIS_PER_BCH;
        const pendingBCH = unconfirmedSatoshis / SATOSHIS_PER_BCH;
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
        logger.info(`[Balance] Calculated balanceData for ${userId}: ${JSON.stringify(balanceData)}`);

        logger.debug(`[Balance] Setting cache for key: ${cacheKey}`);
        cache.set(cacheKey, balanceData, CACHE_TTL_BALANCE); // Cache the result
        return balanceData;
    } catch (error) {
        // Log the error stack for better debugging
        logger.error(`[Balance] Error fetching balance via racing for user ${userId} (Addr: ${keys.address}): ${error.message}`, error.stack);
        // Re-throw a user-friendly error, potentially masking internal details
        throw new Error(`Failed to fetch wallet balance. Please try again later.`);
    }
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
        if (height > 0) { // Only cache valid heights
             cache.set(cacheKey, height, CACHE_TTL_HEIGHT);
        }
        return height;
    } catch (error) {
        logger.error(`[Block Height] Failed to get block height via racing: ${error.message}`);
        throw new Error(`Failed to get current block height: ${error.message}`);
    }
}

// --- ACCURATE getWalletTransactions with MORE DETAILED CLASSIFICATION LOGGING ---
async function getWalletTransactions(userId /*, page, limit */) {
    const historyCacheKey = `history:${userId}`;
    logger.debug(`[History] Checking processed history cache for key: ${historyCacheKey}`);
    const cachedHistory = cache.get(historyCacheKey);
    if (cachedHistory !== undefined) {
        logger.debug(`[History] Processed history Cache HIT for ${userId}. Returning cached list.`);
        return cachedHistory;
    }

    logger.debug(`[History] Processed history Cache MISS for ${userId}. Fetching fresh history...`);

    // Use secure key retrieval
    const keys = await getUserWalletKeys(userId);
    const userAddress = keys.address; // Use derived address
    const scriptHash = addressToScriptHash(userAddress);
    let rate = 0;
    let currentHeight = 0;

    logger.debug(`[History] Fetching accurate history for ${userAddress} (SH: ${scriptHash})`);

    try {
        [rate, currentHeight] = await Promise.all([ // currentHeight is defined here
            getBchToBrlRate(),
            getBlockHeight()
        ]);
        logger.debug(`[History] Current Rate: ${rate}, Current Height: ${currentHeight}`);

        const history = await electrumRequestManager.raceRequest(
            'blockchain.scripthash.get_history',
            [scriptHash]
        );

        if (!history || history.length === 0) {
            logger.debug(`[History] No history found for ${userAddress}`);
            cache.set(historyCacheKey, [], CACHE_TTL_HISTORY);
            return [];
        }
        logger.debug(`[History] Found ${history.length} history items. Fetching details (using cache)...`);

        // --- FIXED: getTxDetailWithCache Definition ---
        const getTxDetailWithCache = async (txid, historyItemHeight, currentBlockHeight) => { // Added params
            const txCacheKey = `tx:${txid}`;
            const cachedTx = cache.get(txCacheKey);
            if (cachedTx !== undefined) {
                return cachedTx;
            }

            logger.debug(`[History Detail Cache] Tx detail Cache MISS for ${txid}. Fetching details...`);
            try {
                const txDetail = await electrumRequestManager.raceRequest('blockchain.transaction.get', [txid, true]);

                if (txDetail) {
                    // --- FIXED: Use passed parameters for TTL calculation ---
                    const blockheight = txDetail.blockheight || (historyItemHeight > 0 ? historyItemHeight : null);
                    const confirmations = blockheight && currentBlockHeight > 0 ? currentBlockHeight - blockheight + 1 : 0;
                    const ttl = confirmations > 0 ? CACHE_TTL_TX_DETAIL_CONFIRMED : CACHE_TTL_TX_DETAIL_UNCONFIRMED;
                    // --- END FIX ---

                    logger.debug(`[History Detail Cache] Setting tx detail cache for ${txid} with TTL: ${ttl}s`);
                    cache.set(txCacheKey, txDetail, ttl);
                } else {
                    logger.warn(`[History Detail] Received null/empty detail for ${txid} from Electrum.`);
                }
                return txDetail;
            } catch (err) {
                 // Log the error but keep the message generic for the function caller
                 logger.error(`[History Detail] Failed fetching/caching details for ${txid}: ${err.message}`);
                 return null; // Return null on error
            }
        };
        // --- End getTxDetailWithCache ---

        // --- FIXED: Pass item.height and currentHeight in the map call ---
        const detailPromises = history.map(item =>
            getTxDetailWithCache(item.tx_hash, item.height, currentHeight) // Pass heights
        );
        // --- END FIX ---

        const transactionDetailsList = await Promise.all(detailPromises);
        // Filter out nulls before logging count
        logger.debug(`[History] Fetched/retrieved details for ${transactionDetailsList.filter(d => d).length} transactions.`);

        // --- Fetching Previous Output Details (No changes needed here) ---
        const neededPrevOutputs = new Map();
        transactionDetailsList.forEach(txDetails => {
            if (!txDetails) return;
            txDetails.vin.forEach(vin => {
                if (vin.coinbase || !vin.txid || vin.vout === undefined) return; // Skip coinbase and invalid inputs
                const key = `${vin.txid}:${vin.vout}`;
                if (!neededPrevOutputs.has(key)) {
                    neededPrevOutputs.set(key, null);
                }
            });
        });

        if (neededPrevOutputs.size > 0) {
            logger.debug(`[History] Need details for ${neededPrevOutputs.size} previous outputs. Fetching (using cache)...`);
            // --- FIXED: Pass heights when fetching prev tx details ---
            const uniquePrevTxids = [...new Set([...neededPrevOutputs.keys()].map(key => key.split(':')[0]))];
            // We don't have the original history item height for *previous* txs, so pass 0 or null
            const prevTxDetailPromises = uniquePrevTxids.map(txid => getTxDetailWithCache(txid, 0, currentHeight));
            // --- END FIX ---
            const prevTransactionDetailsList = await Promise.all(prevTxDetailPromises);

            const prevTxDetailsMap = new Map(prevTransactionDetailsList.filter(d => d).map(d => [d.txid, d]));
            neededPrevOutputs.forEach((_, key) => {
                const [txid, voutStr] = key.split(':');
                const voutIndex = parseInt(voutStr, 10);
                const prevTx = prevTxDetailsMap.get(txid);
                if (prevTx && prevTx.vout && prevTx.vout[voutIndex]) {
                    neededPrevOutputs.set(key, prevTx.vout[voutIndex]);
                } else {
                     logger.warn(`[History Prev Detail] Could not find or access vout ${voutIndex} for prev tx ${txid}`);
                }
            });
            logger.debug(`[History] Successfully fetched/retrieved and mapped details for previous outputs.`);
        } else {
             logger.debug(`[History] No previous output details needed.`);
        }
        // --- End Fetching Previous Output Details ---


        // --- Process Transactions ---
        const processedTxs = [];
        history.forEach((item, index) => { // 'item' is available here
            const txDetails = transactionDetailsList[index]; // This might be null if fetch failed
            if (!txDetails) {
                // Log is already handled inside getTxDetailWithCache catch block
                // logger.warn(`[History Process] Skipping tx index ${index} (tx_hash: ${item.tx_hash}) due to missing details.`);
                return; // Skip this iteration
            }

            try {
                const txid = item.tx_hash;
                // Use height from history item as primary source for confirmations *here*
                const blockHeight = item.height > 0 ? item.height : undefined;
                const confirmations = blockHeight && currentHeight > 0 ? currentHeight - blockHeight + 1 : 0; // Recalculate using item.height
                const status = confirmations > 0 ? 'confirmed' : 'pending';

                // Prefer blocktime if available, fallback to server time
                const blockTimestamp = txDetails.blocktime ? new Date(txDetails.blocktime * 1000).toISOString() : null;
                const serverReceivedTime = txDetails.time ? new Date(txDetails.time * 1000).toISOString() : null;
                const timestamp = blockTimestamp || serverReceivedTime || new Date().toISOString(); // Fallback to now if neither exists

                // Fee calculation - Electrum provides 'fees' in BCH units
                const feeSatoshis = txDetails.fees ? Math.round(txDetails.fees * SATOSHIS_PER_BCH) : 0;

                let totalInputFromUser = 0;
                let sentAmount = 0; // Amount sent to OTHERS
                let receivedAmount = 0; // Amount received by USER (including change)
                let isSentToOthers = false;
                let isOnlyToUser = true; // Assume only to user initially
                let recipient = null; // First recipient address (if sent)
                let userInputsInTx = false;

                // Analyze Inputs
                for (const vin of txDetails.vin) {
                    if (vin.coinbase || !vin.txid || vin.vout === undefined) continue;

                    const key = `${vin.txid}:${vin.vout}`;
                    const prevOutputDetail = neededPrevOutputs.get(key);

                    if (!prevOutputDetail) {
                        // This is critical, classification might be wrong
                        logger.error(`[History Process - Input] CRITICAL: Missing previous output detail for input ${key} in tx ${txid}. Input analysis will be INCORRECT.`);
                        // Decide how to handle: skip tx, mark as error, or proceed with potentially wrong classification?
                        // For now, log and proceed, but this indicates a problem in prev output fetching/caching.
                    } else {
                         const inputValueSat = prevOutputDetail.valueSat ?? Math.round((prevOutputDetail.value || 0) * SATOSHIS_PER_BCH);
                         const prevAddr = prevOutputDetail.scriptPubKey?.addresses?.[0]; // Can be undefined
                         if (prevAddr === userAddress) {
                              totalInputFromUser += inputValueSat;
                              userInputsInTx = true;
                              // logger.debug(`[History Process - Input] TX: ${txid}, Input ${key} belongs to user ${userAddress}. Adding ${inputValueSat}. userInputsInTx = true.`);
                         } else {
                              // logger.debug(`[History Process - Input] TX: ${txid}, Input ${key} does NOT belong to user ${userAddress}. Belongs to: ${prevAddr || 'Unknown'}`);
                         }
                    }
                }

                // Analyze Outputs
                for (const vout of txDetails.vout) {
                    const outputValueSat = vout.valueSat ?? Math.round((vout.value || 0) * SATOSHIS_PER_BCH);
                    const outputAddr = vout.scriptPubKey?.addresses?.[0]; // Can be undefined

                    if (outputAddr && outputAddr !== userAddress) {
                        isSentToOthers = true;
                        sentAmount += outputValueSat; // Add to amount sent to others
                        recipient = recipient || outputAddr; // Capture first recipient
                        isOnlyToUser = false;
                        // logger.debug(`[History Process - Output] TX: ${txid}, Output ${vout.n} to OTHER: ${outputAddr}, Value: ${outputValueSat}.`);
                    } else if (outputAddr === userAddress) {
                        receivedAmount += outputValueSat; // Add to amount received by user (includes change)
                        // logger.debug(`[History Process - Output] TX: ${txid}, Output ${vout.n} to USER: ${outputAddr}, Value: ${outputValueSat}.`);
                    } else {
                        // Output to unknown or non-standard script
                        isOnlyToUser = false;
                        // logger.debug(`[History Process - Output] TX: ${txid}, Output ${vout.n} to UNKNOWN/NON-STANDARD.`);
                    }
                }

                // --- CLASSIFICATION LOGIC (No change needed here) ---
                let type = 'unknown';
                let amountSatoshis = 0; // The amount relevant to the classification type
                let displayAddress = 'N/A';

                if (userInputsInTx && isSentToOthers) { // User sent funds to someone else (might include change back)
                    type = 'sent';
                    amountSatoshis = sentAmount + feeSatoshis;
                    displayAddress = recipient || 'Multiple Recipients';
                } else if (!userInputsInTx && receivedAmount > 0) { // User received funds from external source
                     type = 'received';
                     amountSatoshis = receivedAmount;
                     displayAddress = userAddress;
                } else if (userInputsInTx && !isSentToOthers && receivedAmount > 0) { // User sent funds only to themselves (consolidation, change from failed send?)
                    type = 'self';
                    amountSatoshis = feeSatoshis;
                    displayAddress = userAddress;
                } else { // Complex or unusual transaction
                    logger.warn(`[History Process] Complex/Unknown TX ${txid}. UserInputs: ${userInputsInTx}, SentToOthers: ${isSentToOthers}, ReceivedAmt: ${receivedAmount}, SentAmt: ${sentAmount}`);
                    type = 'unknown';
                    amountSatoshis = 0;
                    displayAddress = 'Complex Interaction';
                }
                // --- END CLASSIFICATION LOGIC ---

                logger.debug(`[TX Classify - Result] TXID: ${txid} - Classified as ${type}. Amount: ${amountSatoshis} sats.`);

                if (amountSatoshis < 0) amountSatoshis = 0;

                const amountBCH = amountSatoshis / SATOSHIS_PER_BCH;
                const amountBRL = amountBCH * rate;
                const feeBCH = (type === 'sent' || type === 'self') ? (feeSatoshis / SATOSHIS_PER_BCH) : undefined;

                processedTxs.push({
                    _id: txid,
                    type,
                    amountBCH,
                    amountBRL,
                    address: displayAddress,
                    txid,
                    timestamp,
                    status,
                    confirmations,
                    blockHeight,
                    fee: feeBCH,
                });

            } catch (procError) {
                 logger.error(`[History Process] Error processing tx ${item.tx_hash}: ${procError.message}`, procError.stack);
                 processedTxs.push({
                     _id: item.tx_hash, type: 'error', amountBCH: 0, amountBRL: 0, address: 'Processing Error',
                     txid: item.tx_hash, timestamp: new Date().toISOString(), status: 'unknown',
                     confirmations: 0, blockHeight: item.height > 0 ? item.height : undefined,
                     fee: undefined, errorMessage: procError.message
                 });
            }
        }); // End history.forEach
        // --- End Process Transactions ---

        // Sort by timestamp descending (most recent first)
        processedTxs.sort((a, b) => {
            const timeA = a.timestamp ? new Date(a.timestamp).getTime() : 0;
            const timeB = b.timestamp ? new Date(b.timestamp).getTime() : 0;
            return timeB - timeA;
        });

        logger.info(`[History] Successfully processed ${processedTxs.length} transactions for ${userAddress}.`);

        // Cache the processed result
        cache.set(historyCacheKey, processedTxs, CACHE_TTL_HISTORY);
        logger.warn(`[History] Caching processed history for ${userAddress}. TTL: ${CACHE_TTL_HISTORY}s. Requires external invalidation for real-time accuracy.`);

        return processedTxs;

    } catch (error) {
        // Catch errors from key retrieval, electrum requests, or processing
        logger.error(`[History] Top-level error fetching/processing history for user ${userId}: ${error.message}`, error.stack);
        // Throw a user-friendly error
        throw new Error(`Failed to fetch transaction history. Please try again later.`);
    }
}
// --- END ACCURATE getWalletTransactions ---


// --- Send Transaction (Uses secure key retrieval) ---
async function sendTransaction(userId, recipientAddress, amountBchStr, feeLevel) {
    // --- IMPORTANT: Invalidate cache after sending ---
    try {
        // Call internal logic which now uses secure key retrieval implicitly
        const result = await sendTransactionInternal(userId, recipientAddress, amountBchStr, feeLevel);

        // If broadcast is successful, invalidate relevant caches
        logger.info(`[Send TX Success] Invalidating cache for user ${userId} after sending ${result.txid}`);
        cache.invalidateUserWalletCache(userId); // Use the helper function
        cache.invalidateBlockHeightCache(); // Invalidate block height as well

        return result;
    } catch (error) {
         // Log error and re-throw
         logger.error(`[Send TX Failure] Error during send transaction: ${error.message}`);
         // Do NOT invalidate cache on failure, as the state might not have changed
         throw error; // Re-throw the original error to be handled by the controller
    }
}

// Internal function containing the original send logic
// It now implicitly uses the secure getUserWalletKeys
async function sendTransactionInternal(userId, recipientAddress, amountBchStr, feeLevel) {
    // Use secure key retrieval
    const keys = await getUserWalletKeys(userId);
    const fromAddress = keys.address;
    const wif = keys.wif; // Get WIF from securely derived keys
    const amountBCH = parseFloat(amountBchStr);

    logger.info(`[Send TX Internal] User: ${userId}, From: ${fromAddress}, To: ${recipientAddress}, Amount: ${amountBchStr} BCH, FeeLevel: ${feeLevel}`);

    // --- Input Validation ---
    if (isNaN(amountBCH) || amountBCH <= 0) { throw new Error('Invalid amount specified.'); }
    // Use bitcore for robust validation
    if (!bitcore.Address.isValid(recipientAddress, network)) { throw new Error('Invalid recipient address.'); }
    const amountSatoshis = Math.round(amountBCH * SATOSHIS_PER_BCH);
    if (amountSatoshis < DUST_THRESHOLD) { throw new Error(`Amount ${amountSatoshis} is below dust threshold ${DUST_THRESHOLD}`); }

    // --- Fee Rate ---
    let feeRateSatsPerByte;
    // TODO: Fetch dynamic fee rate using electrumRequestManager.raceRequest('blockchain.estimatefee', [blocks_target])
    switch (feeLevel) {
      case 'low': feeRateSatsPerByte = 1.0; break; // Absolute minimum relay fee
      case 'high': feeRateSatsPerByte = 1.5; break; // Slightly higher
      case 'medium': default: feeRateSatsPerByte = 1.1; break; // Default slightly above minimum
    }
    logger.info(`[Send TX Internal] Using fee rate: ${feeRateSatsPerByte} sats/byte for level '${feeLevel}'`);

    try {
        // 1. Get UTXOs using racing manager
        const scriptHash = addressToScriptHash(fromAddress);
        logger.debug(`[Send TX Internal] Fetching UTXOs for ${fromAddress} (SH: ${scriptHash})`);
        const utxosRaw = await electrumRequestManager.raceRequest('blockchain.scripthash.listunspent', [scriptHash]);

        if (!utxosRaw || utxosRaw.length === 0) {
            logger.warn(`[Send TX Internal] No UTXOs found for ${fromAddress}.`);
            throw new Error('Insufficient funds (no UTXOs found).');
        }
        logger.debug(`[Send TX Internal] Found ${utxosRaw.length} UTXOs.`);
        // Map to the format bchjs expects (txid, vout, satoshis)
        const utxos = utxosRaw.map(utxo => ({
            txid: utxo.tx_hash,
            vout: utxo.tx_pos,
            satoshis: utxo.value,
        }));

        // 2. Build Transaction using bchjs
        const transactionBuilder = new bchjs.TransactionBuilder(network);
        let totalInputSatoshis = 0;
        utxos.forEach(utxo => {
            transactionBuilder.addInput(utxo.txid, utxo.vout);
            totalInputSatoshis += utxo.satoshis;
        });
        logger.debug(`[Send TX Internal] Total input value: ${totalInputSatoshis} satoshis from ${utxos.length} UTXOs.`);

        // 3. Estimate fee accurately
        const preliminaryOutputCount = 2; // Assume recipient + change
        const byteCountEstimate = bchjs.BitcoinCash.getByteCount({ P2PKH: utxos.length }, { P2PKH: preliminaryOutputCount });
        const feeEstimate = Math.ceil(byteCountEstimate * feeRateSatsPerByte);
        const changeAmountEstimate = totalInputSatoshis - amountSatoshis - feeEstimate;
        const needsChangeOutput = changeAmountEstimate >= DUST_THRESHOLD;

        const finalOutputCount = needsChangeOutput ? 2 : 1;
        const finalByteCount = bchjs.BitcoinCash.getByteCount({ P2PKH: utxos.length }, { P2PKH: finalOutputCount });
        const feeSatoshis = Math.ceil(finalByteCount * feeRateSatsPerByte);
        logger.debug(`[Send TX Internal] Estimated bytes: ${finalByteCount}, Final fee: ${feeSatoshis} satoshis. Needs change: ${needsChangeOutput}`);

        // 4. Check funds against final fee
        if (totalInputSatoshis < amountSatoshis + feeSatoshis) {
            logger.error(`[Send TX Internal] Insufficient funds. Required: ${amountSatoshis + feeSatoshis}, Available: ${totalInputSatoshis}`);
            throw new Error(`Insufficient funds. Required: ${amountSatoshis + feeSatoshis} satoshis, Available: ${totalInputSatoshis} satoshis.`);
        }

        // 5. Add outputs
        transactionBuilder.addOutput(recipientAddress, amountSatoshis);
        logger.debug(`[Send TX Internal] Added output: ${amountSatoshis} satoshis to ${recipientAddress}`);
        const changeAmountSatoshis = totalInputSatoshis - amountSatoshis - feeSatoshis;
        if (needsChangeOutput) {
            logger.debug(`[Send TX Internal] Added change output: ${changeAmountSatoshis} satoshis to ${fromAddress}`);
            transactionBuilder.addOutput(fromAddress, changeAmountSatoshis);
        } else {
            const implicitMinerFee = totalInputSatoshis - amountSatoshis - feeSatoshis;
            if (implicitMinerFee > 0) {
                 logger.debug(`[Send TX Internal] No change output needed. ${implicitMinerFee} satoshis added to miner fee.`);
            } else {
                 logger.debug(`[Send TX Internal] No change output needed.`);
            }
        }

        // 6. Sign Transaction
        const keyPair = bchjs.ECPair.fromWIF(wif);
        logger.debug(`[Send TX Internal] Signing ${utxos.length} inputs...`);
        utxos.forEach((utxo, index) => {
            transactionBuilder.sign(index, keyPair, undefined, transactionBuilder.hashTypes.SIGHASH_ALL, utxo.satoshis);
        });

        // 7. Build and get Hex
        const tx = transactionBuilder.build();
        const txHex = tx.toHex();
        logger.debug(`[Send TX Internal] Transaction built. Hex length: ${txHex.length}`);

        // 8. Broadcast using racing manager
        logger.info(`[Send TX Internal] Broadcasting transaction hex via racing manager...`);
        const txid = await electrumRequestManager.raceRequest('blockchain.transaction.broadcast', [txHex]);

        // Validate response
        if (!txid || typeof txid !== 'string' || txid.length < 64) {
             logger.error(`[Send TX Internal] Broadcast attempt did not return a valid txid string. Result: ${JSON.stringify(txid)}`);
             throw new Error('Transaction broadcast may have failed or succeeded without confirmation. Please check history.');
        }

        logger.info(`[Send TX Internal] Transaction sent successfully. Txid: ${txid}`);
        return { txid }; // Return result object

    } catch (error) {
        logger.error(`[Send TX Internal] Error: ${error.message}`, error.stack);
        // Pass specific error messages for better handling in the controller
        if (error.message.includes('Insufficient funds')) {
            throw new Error('Insufficient funds to cover the amount and transaction fee.');
        }
        if (error.message.includes('Invalid recipient address')) {
             throw new Error('Invalid recipient address.');
        }
        if (error.message.includes('below dust threshold')) {
             throw new Error('Transaction amount is too small (below dust threshold).');
        }
        if (error.message.includes('Invalid amount')) {
             throw new Error('Invalid amount specified.');
        }
        if (error.message.includes('timeout') || error.message.includes('No connected Electrum servers')) {
            throw new Error('Network error during transaction broadcast. Please check your transaction history to confirm status.');
        }
        // Generic fallback for other errors (like key derivation issues caught earlier)
        throw new Error(`Failed to send transaction: ${error.message}`);
    }
}
// --- End Send Transaction ---


// --- Generate New Address for Order ---
async function generateNewAddressForOrder(store, userId) {
  // Derive um novo endereço HD (ex: m/44'/145'/0'/0/{orderIndex})
  // Use o índice do pedido ou um contador seguro
  // Retorne o endereço BCH (CashAddr)
}
// --- End Generate New Address for Order ---


// --- WebSocket Subscription Logic is Handled by spvMonitorService ---
// (No changes needed here)

// --- Module Exports ---
module.exports = {
    getWalletAddress,
    getWalletBalance,
    getWalletTransactions, // Export the accurate version
    sendTransaction,
    // getUserWalletKeys // Keep internal unless needed elsewhere
    generateNewAddressForOrder, // Export the new function
};
