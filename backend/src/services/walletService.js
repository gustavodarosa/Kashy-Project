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
// --- ADDED: Import Transaction model ---
const Transaction = require('../models/transaction');
// --- END ADDED ---

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

// --- ADDED: Function to save transaction if it doesn't exist ---
/**
 * Saves a transaction to the database if it doesn't already exist based on txid.
 * Also updates existing transactions if their confirmation status changes.
 * @param {object} tx - The formatted transaction object (matching the Transaction model schema).
 * @param {string|mongoose.Types.ObjectId} userId - The ID of the user associated with the transaction.
 */
async function saveTransactionIfNotExists(tx, userId) {
  if (!tx || !tx.txid) {
    logger.warn('[Save TX] Attempted to save invalid transaction data:', tx);
    return;
  }
  try {
    // Data structure for saving/updating, ensuring consistency
    const txDataForDb = {
      userId: userId,
      address: tx.address, // Use the display address from processing
      txid: tx.txid,
      amount: tx.amountBCH, // Assuming 'amount' in schema is BCH
      type: tx.type, // 'sent', 'received', 'unknown'
      timestamp: new Date(tx.timestamp), // Ensure it's a Date object
      confirmed: tx.status === 'confirmed', // Set based on processed status
      confirmations: tx.confirmations || 0, // Save confirmations count
      // seen: false, // Don't reset 'seen' status on update
      convertedBRL: tx.amountBRL, // Store the calculated BRL value
      // linkedOrderId: tx.linkedOrderId, // Add linkedOrderId here when available
    };

    // Validate type before saving/updating
    if (!['sent', 'received', 'unknown'].includes(txDataForDb.type)) {
        logger.warn(`[Save TX] Invalid transaction type '${txDataForDb.type}' for txid ${txDataForDb.txid}. Saving as 'unknown'.`);
        txDataForDb.type = 'unknown';
    }
    // Skip saving types not in the enum if desired (e.g., 'error', 'self')
    if (txDataForDb.type === 'error' || txDataForDb.type === 'self') {
        logger.info(`[Save TX] Skipping save for txid ${txDataForDb.txid} due to type: ${txDataForDb.type}`);
        return;
    }

    // Find existing transaction first
    const existingTx = await Transaction.findOne({ txid: tx.txid, userId: userId });

    if (!existingTx) {
      // Transaction doesn't exist, create it
      logger.debug(`[Save TX - Create] Saving new TX: ${JSON.stringify({ ...txDataForDb, seen: false })}`); // Log data being created
      await Transaction.create({ ...txDataForDb, seen: false }); // Add default 'seen' for new ones
      logger.info(`[Save TX] Saved new transaction: User ${userId}, TXID ${tx.txid}`);

    } else {
      // Transaction exists, check if it needs updating (e.g., confirmation status)
      // --- MODIFICATION: Always update with the latest processed data ---
      // Use findOneAndUpdate to ensure atomicity and update based on latest data
      // We only preserve the 'seen' status from the existing document.
      const updatePayload = { $set: { ...txDataForDb, seen: existingTx.seen } };
      logger.debug(`[Save TX - Update] Updating TX ${tx.txid} with payload: ${JSON.stringify(updatePayload)}`); // Log data being updated
      const updateResult = await Transaction.findOneAndUpdate(
        { txid: tx.txid, userId: userId },
        updatePayload, // Update all fields except 'seen'
        { new: true, upsert: false } // Don't upsert, return updated doc
      );
      if (updateResult) {
          logger.info(`[Save TX] Updated existing transaction: User ${userId}, TXID ${tx.txid}`);
      } else {
          // This case should ideally not happen if findOne found it, but log just in case
          logger.warn(`[Save TX] Failed to find and update existing transaction: User ${userId}, TXID ${tx.txid}`);
      }
      // --- END MODIFICATION ---
    }
  } catch (error) {
    logger.error(`[Save TX] Error saving/updating transaction ${tx.txid} for user ${userId}: ${error.message}`, error.stack);
    // Decide if you want to throw the error or just log it
  }
}
// --- END ADDED ---


// --- Service Functions (Using electrumRequestManager AND Cache) ---

async function getWalletAddress(userId) {
    // No caching needed here, just key derivation
    const keys = await getUserWalletKeys(userId); // Now uses the secure method
    return keys.address;
}

/**
 * Gets the wallet balance, optionally skipping BRL calculation.
 */
async function getWalletBalance(userId, skipBrlCalculation = false) {
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

    let rate = 0;
    if (!skipBrlCalculation) {
        try {
            rate = await getBchToBrlRate(); // Rate is cached in its own service
        } catch (rateError) {
            logger.warn(`[Balance] Failed to get BRL rate for user ${userId}: ${rateError.message}. BRL values will be 0.`);
        }
    }

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
        const totalBRL = rate > 0 ? totalBCH * rate : 0; // Calculate only if rate is valid

        const balanceData = {
            totalBCH,
            availableBCH,
            pendingBCH,
            totalBRL,
            // Also include satoshi values directly for integrity check
            totalSatoshis: { confirmed: confirmedSatoshis, unconfirmed: unconfirmedSatoshis },
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
async function getWalletTransactions(userId, page = 1, limit = 20) { // Add page and limit parameters
    // Calculate skip based on page and limit
    const skip = (page - 1) * limit;
    logger.info(`[History Service] Fetching transactions for User: ${userId}, Page: ${page}, Limit: ${limit}`);

    const historyCacheKey = `history:${userId}`;
    logger.debug(`[History] Checking processed history cache for key: ${historyCacheKey}`);
    const cachedHistory = cache.get(historyCacheKey);

    // --- MODIFICATION: Cache check needs to consider pagination ---
    // Simple approach: Invalidate cache more aggressively (e.g., on any SPV update) and remove pagination from cache key for now.
    // Complex approach: Cache paginated results `history:${userId}:p${page}:l${limit}` - more complex invalidation.
    // For now, let's bypass the cache read here as pagination makes it complex.
    // We will still cache the *full* processed list later if needed, but the paginated result won't be cached directly this way.
    // TODO: Re-evaluate caching strategy for paginated history if performance becomes an issue.
    /*
    if (cachedHistory !== undefined) {
        logger.debug(`[History] Processed history Cache HIT for ${userId}. Returning cached list.`);
        return cachedHistory;
    }

    logger.debug(`[History] Processed history Cache MISS for ${userId}. Fetching fresh history...`);

    */
    // Use secure key retrieval
    const keys = await getUserWalletKeys(userId);
    const userAddress = keys.address; // Use derived address
    const scriptHash = addressToScriptHash(userAddress);
    let rate = 0;
    let currentHeight = 0;

    logger.debug(`[History] Fetching accurate history for ${userAddress} (SH: ${scriptHash})`);

    try {
        // Fetch rate separately and handle potential errors
        try {
            rate = await getBchToBrlRate();
        } catch (rateError) {
            logger.warn(`[History] Failed to get BRL rate for user ${userId}: ${rateError.message}. BRL values will be 0.`);
            rate = 0; // Default to 0 if fetch fails
        }
        currentHeight = await getBlockHeight(); // Fetch height

        logger.debug(`[History] Current Rate: ${rate}, Current Height: ${currentHeight}`);

        const history = await electrumRequestManager.raceRequest(
            'blockchain.scripthash.get_history',
            [scriptHash]
        );

        if (!history || history.length === 0) {
            logger.debug(`[History] No history found for ${userAddress}`);
            // Return empty structure matching the final expected output
            // cache.set(historyCacheKey, [], CACHE_TTL_HISTORY); // Don't cache empty results long
            // return []; // Old return
            return { transactions: [], totalCount: 0 }; // Return structure with count
        }
        logger.debug(`[History] Found ${history.length} history items. Fetching details (using cache)...`);

        // --- Helper function to get transaction details with caching ---
        const getTxDetailWithCache = async (txid, historyItemHeight, currentBlockHeight) => {
            const txCacheKey = `tx:${txid}`;
            const cachedTx = cache.get(txCacheKey);
            if (cachedTx !== undefined) {
                return cachedTx;
            }

            logger.debug(`[History Detail Cache] Tx detail Cache MISS for ${txid}. Fetching details...`);
            try {
                const txDetail = await electrumRequestManager.raceRequest('blockchain.transaction.get', [txid, true]);

                if (txDetail) {
                    // Determine TTL based on confirmation status
                    const blockheight = txDetail.blockheight || (historyItemHeight > 0 ? historyItemHeight : null);
                    const confirmations = blockheight && currentBlockHeight > 0 ? currentBlockHeight - blockheight + 1 : 0;
                    const ttl = confirmations > 0 ? CACHE_TTL_TX_DETAIL_CONFIRMED : CACHE_TTL_TX_DETAIL_UNCONFIRMED;

                    logger.debug(`[History Detail Cache] Setting tx detail cache for ${txid} with TTL: ${ttl}s`);
                    cache.set(txCacheKey, txDetail, ttl);
                } else {
                    logger.warn(`[History Detail] Received null/empty detail for ${txid} from Electrum.`);
                }
                return txDetail;
            } catch (err) {
                 logger.error(`[History Detail] Failed fetching/caching details for ${txid}: ${err.message}`);
                 return null; // Return null on error
            }
        };
        // --- End getTxDetailWithCache ---

        // --- Fetch details for all transactions in history ---
        const detailPromises = history.map(item =>
            getTxDetailWithCache(item.tx_hash, item.height, currentHeight) // Pass heights
        );
        const transactionDetailsList = await Promise.all(detailPromises);
        logger.debug(`[History] Fetched/retrieved details for ${transactionDetailsList.filter(d => d).length} transactions.`);

        // --- Fetching Previous Output Details ---
        const neededPrevOutputs = new Map();
        transactionDetailsList.forEach(txDetails => {
            if (!txDetails) return;
            txDetails.vin.forEach(vin => {
                if (vin.coinbase || !vin.txid || vin.vout === undefined) return;
                const key = `${vin.txid}:${vin.vout}`;
                if (!neededPrevOutputs.has(key)) {
                    neededPrevOutputs.set(key, null);
                }
            });
        });

        if (neededPrevOutputs.size > 0) {
            logger.debug(`[History] Need details for ${neededPrevOutputs.size} previous outputs. Fetching (using cache)...`);
            const uniquePrevTxids = [...new Set([...neededPrevOutputs.keys()].map(key => key.split(':')[0]))];
            // Pass 0 for historyItemHeight as we don't have it for prev txs
            const prevTxDetailPromises = uniquePrevTxids.map(txid => getTxDetailWithCache(txid, 0, currentHeight));
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
        // const processedTxs = []; // We won't store the full list in memory anymore
        const savePromises = []; // Array to hold save promises

        history.forEach((item, index) => {
            const txDetails = transactionDetailsList[index];
            if (!txDetails) {
                return; // Skip this iteration if details are missing
            }

            try {
                const txid = item.tx_hash;
                const blockHeight = item.height > 0 ? item.height : undefined;
                const confirmations = blockHeight && currentHeight > 0 ? currentHeight - blockHeight + 1 : 0;
                const status = confirmations > 0 ? 'confirmed' : 'pending';
                const blockTimestamp = txDetails.blocktime ? new Date(txDetails.blocktime * 1000).toISOString() : null;
                const serverReceivedTime = txDetails.time ? new Date(txDetails.time * 1000).toISOString() : null;
                const timestamp = blockTimestamp || serverReceivedTime || new Date().toISOString();
                const feeSatoshis = txDetails.fees ? Math.round(txDetails.fees * SATOSHIS_PER_BCH) : 0;

                let totalSpentByUser = 0; // Total value from inputs belonging to the user
                let totalReceivedByUser = 0; // Total value in outputs belonging to the user (including change)
                let firstOtherRecipientAddress = null; // First recipient address (if sent)
                let amountSentToOthers = 0; // Sum of outputs NOT going to the user
                let userInputsInTx = false;

                // Analyze Inputs
                for (const vin of txDetails.vin) {
                    if (vin.coinbase || !vin.txid || vin.vout === undefined) continue;
                    const key = `${vin.txid}:${vin.vout}`;
                    const prevOutputDetail = neededPrevOutputs.get(key);

                    if (!prevOutputDetail) {
                        logger.error(`[History Process - Input] CRITICAL: Missing previous output detail for input ${key} in tx ${txid}. Classification may be incorrect.`);
                    } else {
                         const inputValueSat = prevOutputDetail.valueSat ?? Math.round((prevOutputDetail.value || 0) * SATOSHIS_PER_BCH); // Electrum provides 'value', bch-js might use 'valueSat'
                         const prevAddr = prevOutputDetail.scriptPubKey?.addresses?.[0]; // Assuming single address outputs for inputs for simplicity
                         if (prevAddr === userAddress) {
                              totalSpentByUser += inputValueSat; // Accumulate value spent from user's UTXOs
                              userInputsInTx = true;
                         }
                    }
                }

                // Analyze Outputs
                for (const vout of txDetails.vout) {
                    const outputValueSat = vout.valueSat ?? Math.round((vout.value || 0) * SATOSHIS_PER_BCH);
                    const outputAddr = vout.scriptPubKey?.addresses?.[0];

                    if (outputAddr === userAddress) {
                        totalReceivedByUser += outputValueSat; // FIX: Use the renamed variable
                    } else if (outputAddr) {
                        // This output goes to someone else
                        amountSentToOthers += outputValueSat;
                        firstOtherRecipientAddress = firstOtherRecipientAddress || outputAddr;
                    }
                }

                // --- CLASSIFICATION LOGIC ---
                const netSatoshisChange = totalReceivedByUser - totalSpentByUser;
                let type = 'unknown';
                let amountSatoshis = 0;
                let displayAddress = 'N/A';

                if (netSatoshisChange > 0 && !userInputsInTx) { // Received funds from external source
                    type = 'received';
                    amountSatoshis = netSatoshisChange; // Net gain is the received amount
                    // Find the sender? Hard without full input details. Display own address.
                    displayAddress = userAddress; // Or potentially find sender from inputs if needed
                } else if (netSatoshisChange < 0 && userInputsInTx) { // Sent funds
                    type = 'sent';
                    // Amount should be what was sent to others, EXCLUDING change
                    amountSatoshis = amountSentToOthers;
                    displayAddress = firstOtherRecipientAddress || 'Multiple Recipients';
                } else if (netSatoshisChange === -feeSatoshis && userInputsInTx && amountSentToOthers === 0) { // Self-send / Consolidation
                    type = 'sent'; // Still involves spending UTXOs
                    amountSatoshis = 0; // No value sent externally, only fee paid
                    displayAddress = userAddress; // Sent to self
                } else {
                    logger.warn(`[History Process] Complex/Unknown TX type ${txid}. NetChange: ${netSatoshisChange}, UserInputs: ${userInputsInTx}, ReceivedByUser: ${totalReceivedByUser}, SentToOthers: ${amountSentToOthers}, Fee: ${feeSatoshis}`);
                    type = 'unknown';
                    amountSatoshis = 0;
                    displayAddress = 'Complex Interaction';
                }
                // --- END CLASSIFICATION LOGIC ---

                logger.debug(`[TX Classify - Result] TXID: ${txid} - Classified as ${type}. Amount: ${amountSatoshis} sats.`);
                if (amountSatoshis < 0) amountSatoshis = 0;

                const amountBCH = amountSatoshis / SATOSHIS_PER_BCH;
                const amountBRL = rate > 0 ? amountBCH * rate : 0; // Calculate only if rate is valid
                const feeBCH = (type === 'sent') ? (feeSatoshis / SATOSHIS_PER_BCH) : undefined;

                const processedTx = {
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
                };

                // processedTxs.push(processedTx); // Don't collect in memory
                savePromises.push(saveTransactionIfNotExists(processedTx, userId));

            } catch (procError) {
                 logger.error(`[History Process] Error processing tx ${item.tx_hash}: ${procError.message}`, procError.stack);
                 // Optionally save an 'error' transaction state if needed
                 /*
                 processedTxs.push({
                     _id: item.tx_hash, type: 'error', amountBCH: 0, amountBRL: 0, address: 'Processing Error',
                     txid: item.tx_hash, timestamp: new Date().toISOString(), status: 'unknown',
                     confirmations: 0, blockHeight: item.height > 0 ? item.height : undefined,
                     fee: undefined, errorMessage: procError.message
                 });
                 */
            }
        }); // End history.forEach
        // --- End Process Transactions ---

        // Wait for all save operations to complete
        await Promise.allSettled(savePromises);
        logger.info(`[History] Finished attempting to save/update ${savePromises.length} transactions to DB for user ${userId}.`);

        // --- MODIFICATION: Fetch paginated results from DB AFTER saving/updating ---
        logger.info(`[History] Fetching final paginated results from DB. Skip: ${skip}, Limit: ${limit}`);
        const [paginatedTransactions, totalCount] = await Promise.all([
             Transaction.find({ userId: userId })
                .sort({ timestamp: -1 }) // Ensure consistent sorting
                .skip(skip)
                .limit(limit)
                .lean(),
             Transaction.countDocuments({ userId: userId })
        ]);
        // --- ADDED DEBUG LOG ---
        // Log the first few transactions fetched from DB to check their amounts
        logger.debug(`[History] Data fetched from DB for page ${page}: ${JSON.stringify(paginatedTransactions.slice(0, 5))}... (showing max 5)`);
        logger.info(`[History] Returning ${paginatedTransactions.length} transactions for page ${page}. Total count: ${totalCount}.`);
        // --- END MODIFICATION ---

        // Cache the processed result (Optional: Cache the full list? Or paginated? For now, skip caching paginated result)
        // cache.set(historyCacheKey, processedTxs, CACHE_TTL_HISTORY); // Caching full list might be heavy
        // logger.warn(`[History] Caching processed history for ${userAddress}. TTL: ${CACHE_TTL_HISTORY}s. Requires external invalidation for real-time accuracy.`);

        // Return the paginated data and total count
        return { transactions: paginatedTransactions, totalCount };

    } catch (error) {
        logger.error(`[History] Top-level error fetching/processing history for user ${userId}: ${error.message}`, error.stack);
        throw new Error(`Failed to fetch transaction history. Please try again later.`);
    }
}
// --- END ACCURATE getWalletTransactions ---


// --- Send Transaction (Wrapper with Cache Invalidation and DB Save) ---
async function sendTransaction(userId, recipientAddress, amountBchStr, feeLevel) {
    let txid = null;
    try {
        // Call internal logic
        const result = await sendTransactionInternal(userId, recipientAddress, amountBchStr, feeLevel);
        txid = result.txid;

        // Invalidate cache on success
        logger.info(`[Send TX Success] Invalidating cache for user ${userId} after sending ${txid}`);
        cache.invalidateUserWalletCache(userId);
        cache.invalidateBlockHeightCache();

        // --- Save sent transaction to DB (fire-and-forget) ---
        if (txid) {
            getBchToBrlRate().then(rate => {
                const amountBCH = parseFloat(amountBchStr);
                const amountBRL = rate > 0 ? amountBCH * rate : 0; // Handle missing rate
                const sentTxData = {
                    type: 'sent',
                    amountBCH: amountBCH,
                    amountBRL: amountBRL,
                    address: recipientAddress,
                    txid: txid,
                    timestamp: new Date().toISOString(),
                    status: 'pending',
                    confirmations: 0,
                    blockHeight: undefined,
                    fee: undefined, // Fee details might need to be fetched/updated later
                };
                saveTransactionIfNotExists(sentTxData, userId)
                    .then(() => logger.info(`[Send TX Save] Initiated save for sent transaction ${txid}`))
                    .catch(saveError => logger.error(`[Send TX Save] Failed to save sent transaction ${txid} to DB: ${saveError.message}`));
            }).catch(rateError => {
                logger.error(`[Send TX Save] Could not get BRL rate to save sent transaction ${txid}: ${rateError.message}. Saving with BRL 0.`);
                // Save without BRL if rate fetch fails
                 const amountBCH = parseFloat(amountBchStr);
                 const sentTxData = {
                     type: 'sent', amountBCH: amountBCH, amountBRL: 0, address: recipientAddress,
                     txid: txid, timestamp: new Date().toISOString(), status: 'pending',
                     confirmations: 0, blockHeight: undefined, fee: undefined,
                 };
                 saveTransactionIfNotExists(sentTxData, userId)
                     .then(() => logger.info(`[Send TX Save] Initiated save for sent transaction ${txid} (BRL 0)`))
                     .catch(saveError => logger.error(`[Send TX Save] Failed to save sent transaction ${txid} to DB (BRL 0): ${saveError.message}`));
            });
        }
        // --- End Save ---

        return result; // Return { txid }
    } catch (error) {
         logger.error(`[Send TX Failure] Error during send transaction: ${error.message}`);
         throw error; // Re-throw the original error
    }
}

// Internal function containing the core send logic
async function sendTransactionInternal(userId, recipientAddress, amountBchStr, feeLevel) {
    const keys = await getUserWalletKeys(userId);
    const fromAddress = keys.address;
    const wif = keys.wif;
    const amountBCH = parseFloat(amountBchStr);

    logger.info(`[Send TX Internal] User: ${userId}, From: ${fromAddress}, To: ${recipientAddress}, Amount: ${amountBchStr} BCH, FeeLevel: ${feeLevel}`);

    // Input Validation
    if (isNaN(amountBCH) || amountBCH <= 0) { throw new Error('Invalid amount specified.'); }
    if (!bitcore.Address.isValid(recipientAddress, network)) { throw new Error('Invalid recipient address.'); }
    const amountSatoshis = Math.round(amountBCH * SATOSHIS_PER_BCH);
    if (amountSatoshis < DUST_THRESHOLD) { throw new Error(`Amount ${amountSatoshis} is below dust threshold ${DUST_THRESHOLD}`); }

    // Fee Rate
    let feeRateSatsPerByte;
    switch (feeLevel) {
      case 'low': feeRateSatsPerByte = 1.0; break;
      case 'high': feeRateSatsPerByte = 1.5; break;
      case 'medium': default: feeRateSatsPerByte = 1.1; break;
    }
    logger.info(`[Send TX Internal] Using fee rate: ${feeRateSatsPerByte} sats/byte for level '${feeLevel}'`);

    try {
        // 1. Get UTXOs
        const scriptHash = addressToScriptHash(fromAddress);
        logger.debug(`[Send TX Internal] Fetching UTXOs for ${fromAddress} (SH: ${scriptHash})`);
        const utxosRaw = await electrumRequestManager.raceRequest('blockchain.scripthash.listunspent', [scriptHash]);

        if (!utxosRaw || utxosRaw.length === 0) {
            logger.warn(`[Send TX Internal] No UTXOs found for ${fromAddress}.`);
            throw new Error('Insufficient funds (no UTXOs found).');
        }
        const utxos = utxosRaw.map(utxo => ({ txid: utxo.tx_hash, vout: utxo.tx_pos, satoshis: utxo.value }));
        logger.debug(`[Send TX Internal] Found ${utxos.length} UTXOs.`);

        // 2. Build Transaction
        const transactionBuilder = new bchjs.TransactionBuilder(network);
        let totalInputSatoshis = 0;
        utxos.forEach(utxo => {
            transactionBuilder.addInput(utxo.txid, utxo.vout);
            totalInputSatoshis += utxo.satoshis;
        });
        logger.debug(`[Send TX Internal] Total input value: ${totalInputSatoshis} satoshis.`);

        // 3. Estimate fee
        const preliminaryOutputCount = 2;
        const byteCountEstimate = bchjs.BitcoinCash.getByteCount({ P2PKH: utxos.length }, { P2PKH: preliminaryOutputCount });
        const feeEstimate = Math.ceil(byteCountEstimate * feeRateSatsPerByte);
        const changeAmountEstimate = totalInputSatoshis - amountSatoshis - feeEstimate;
        const needsChangeOutput = changeAmountEstimate >= DUST_THRESHOLD;
        const finalOutputCount = needsChangeOutput ? 2 : 1;
        const finalByteCount = bchjs.BitcoinCash.getByteCount({ P2PKH: utxos.length }, { P2PKH: finalOutputCount });
        const feeSatoshis = Math.ceil(finalByteCount * feeRateSatsPerByte);
        logger.debug(`[Send TX Internal] Estimated bytes: ${finalByteCount}, Final fee: ${feeSatoshis} satoshis. Needs change: ${needsChangeOutput}`);

        // 4. Check funds
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
             logger.debug(`[Send TX Internal] No change output needed. ${implicitMinerFee} satoshis added to miner fee.`);
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

        // 8. Broadcast
        logger.info(`[Send TX Internal] Broadcasting transaction hex via racing manager...`);
        const txid = await electrumRequestManager.raceRequest('blockchain.transaction.broadcast', [txHex]);

        if (!txid || typeof txid !== 'string' || txid.length < 64) {
             logger.error(`[Send TX Internal] Broadcast attempt did not return a valid txid string. Result: ${JSON.stringify(txid)}`);
             throw new Error('Transaction broadcast may have failed or succeeded without confirmation. Please check history.');
        }

        logger.info(`[Send TX Internal] Transaction sent successfully. Txid: ${txid}`);
        return { txid };

    } catch (error) {
        logger.error(`[Send TX Internal] Error: ${error.message}`, error.stack);
        // Pass specific error messages
        if (error.message.includes('Insufficient funds')) { throw new Error('Insufficient funds to cover the amount and transaction fee.'); }
        if (error.message.includes('Invalid recipient address')) { throw new Error('Invalid recipient address.'); }
        if (error.message.includes('below dust threshold')) { throw new Error('Transaction amount is too small (below dust threshold).'); }
        if (error.message.includes('Invalid amount')) { throw new Error('Invalid amount specified.'); }
        if (error.message.includes('timeout') || error.message.includes('No connected Electrum servers')) { throw new Error('Network error during transaction broadcast. Please check your transaction history to confirm status.'); }
        throw new Error(`Failed to send transaction: ${error.message}`);
    }
}
// --- End Send Transaction ---


// --- WebSocket Subscription Logic is Handled by spvMonitorService ---


// --- ADDED: Function to check DB vs Blockchain balance consistency ---
async function checkTransactionIntegrity(userId) {
  logger.debug(`[Integrity Check] Starting check for user ${userId}`);
  try {
    // Fetch live balance (satoshi value needed) and DB transactions concurrently
    // No need to fetch BRL rate here anymore.
    const [liveBalanceData, dbTransactions] = await Promise.all([
      getWalletBalance(userId, true), // Pass flag to skip BRL calculation in getWalletBalance
      Transaction.find({ userId }).lean()
    ]);

    // Calculate the net balance based *only* on transactions stored in the DB
    // This calculation needs to accurately reflect how the balance changes
    let totalFromDbSatoshis = 0;
    // --- REVISED CALCULATION: Only sum confirmed 'received' transactions ---
    logger.debug(`[Integrity Check] Calculating DB balance from confirmed 'received' transactions (${dbTransactions.length} total)...`);
    for (const tx of dbTransactions) {
        const txidShort = tx.txid.substring(0, 8);
        // Ensure amount is treated as a number, default to 0 if invalid/missing
        const txAmountBCH = typeof tx.amount === 'number' ? tx.amount : 0;
        const amountSat = Math.round(txAmountBCH * SATOSHIS_PER_BCH);

        // Only add confirmed received amounts to the total
        if (tx.type === 'received' && tx.confirmed) {
            logger.debug(`[Integrity Check Loop] TX ${txidShort} (${tx.type}): Adding ${amountSat} sats. Prev total: ${totalFromDbSatoshis}`);
            totalFromDbSatoshis += amountSat;
        }
    }


    // Compare against the *confirmed* live balance
    // Use totalSatoshis directly if available, otherwise calculate from availableBCH
    const liveConfirmedSatoshis = liveBalanceData.totalSatoshis?.confirmed ?? Math.round(liveBalanceData.availableBCH * SATOSHIS_PER_BCH);

    // Use a tolerance for potential fee discrepancies or minor rounding issues if needed
    // const tolerance = 10; // Example: Allow 10 satoshi difference
    // const isConsistent = Math.abs(liveConfirmedSatoshis - totalFromDbSatoshis) <= tolerance;
    // --- END REVISED CALCULATION ---

    // Direct comparison: Live balance should equal the sum of confirmed received transactions
    // --- REVISED CONSISTENCY LOGIC ---
    // It's consistent if the live balance is LESS THAN OR EQUAL TO the total received according to DB.
    // It's INCONSISTENT only if the live balance is GREATER than what the DB accounts for as received.
    const isConsistent = liveConfirmedSatoshis <= totalFromDbSatoshis;
    // --- END REVISED CONSISTENCY LOGIC ---

    // Add more context to the log message
    logger.debug(`[Integrity Check] User ${userId}: Live Confirmed Sats = ${liveConfirmedSatoshis}, DB Sum of Confirmed Received Sats = ${totalFromDbSatoshis}. Consistent = ${isConsistent} (Live <= DB Received? ${isConsistent})`);
    return { isConsistent, onChainSatoshis: liveConfirmedSatoshis, dbCalculatedSatoshis: totalFromDbSatoshis };

  } catch (error) {
    logger.error(`[Integrity Check] Error checking integrity for user ${userId}: ${error.message}`, error.stack);
    throw new Error(`Failed to check wallet integrity: ${error.message}`); // Re-throw wrapped error
  }
}
// --- END ADDED ---


// --- Module Exports ---
module.exports = {
    getWalletAddress,
    getWalletBalance,
    getWalletTransactions, // Export the accurate version
    sendTransaction,
    // getUserWalletKeys // Keep internal unless needed elsewhere
    checkTransactionIntegrity, // Export the new function
    // syncWalletTransactions, // This logic is now integrated into getWalletTransactions
};
