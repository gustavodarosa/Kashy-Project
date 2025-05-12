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
const Transaction = require('../models/transaction'); // Assuming path is correct
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
  // --- ADDED LOG: Log received data ---
  logger.info(`[Save TX - Entry] Received attempt to save TX for User ${userId}. Data: ${JSON.stringify(tx)}`);

  if (!tx || !tx.txid) {
    logger.warn('[Save TX] Attempted to save invalid transaction data:', tx);
    return;
  }

  try {
    // Data structure for saving/updating, ensuring consistency
    const txDataForDb = {
      userId: userId,
      address: tx.address, // Use the display address from processing
      txid: tx.txid, // Use txid from input
      amount: tx.amount, // <-- Use 'amount' directly from input (should be BCH)
      type: tx.type, // 'sent', 'received', 'unknown'
      timestamp: new Date(tx.timestamp), // Ensure it's a Date object
      confirmed: tx.status === 'confirmed', // Set based on processed status
      confirmations: tx.confirmations || 0, // Save confirmations count
      fee: tx.fee, // <-- Add fee from input tx object
      // seen: false, // Don't reset 'seen' status on update
      convertedBRL: tx.amountBRL || tx.convertedBRL, // Store the calculated BRL value (handle both key names)
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
    logger.debug(`[Save TX - Find] Searching for existing TX with txid: ${tx.txid} and userId: ${userId}`);
    const existingTx = await Transaction.findOne({ txid: tx.txid, userId: userId });
    logger.debug(`[Save TX - Find Result] Existing TX found: ${existingTx ? existingTx._id : 'None'}`);

    if (!existingTx) {
      // Transaction doesn't exist, create it
      logger.debug(`[Save TX - Create] Saving new TX: ${JSON.stringify({ ...txDataForDb, seen: false })}`); // Log data being created
      await Transaction.create({ ...txDataForDb, seen: false }); // Add default 'seen' for new ones
      logger.info(`[Save TX] Saved new transaction: User ${userId}, TXID ${tx.txid}`);

    } else {
      // Transaction exists, update with the latest processed data
      // Use findOneAndUpdate to ensure atomicity and update based on latest data.
      // Preserve the 'seen' status from the existing document.
      const updatePayload = { $set: { ...txDataForDb, seen: existingTx.seen } };
      logger.debug(`[Save TX - Update] Updating TX ${tx.txid} with payload: ${JSON.stringify(updatePayload)}`); // Log data being updated
      const updateResult = await Transaction.findOneAndUpdate(
        { txid: tx.txid, userId: userId },
        updatePayload,
        { new: true, upsert: false } // Don't upsert, return updated doc
      );
      if (updateResult) {
          logger.info(`[Save TX] Updated existing transaction: User ${userId}, TXID ${tx.txid}`);
      } else {
          logger.warn(`[Save TX] Failed to find and update existing transaction: User ${userId}, TXID ${tx.txid}`);
      }
    }
  } catch (error) {
    logger.error(`[Save TX] Error saving/updating transaction ${tx.txid} for user ${userId}: ${error.message}`, error.stack);
  }
}
// --- END ADDED ---


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

    const keys = await getUserWalletKeys(userId);
    const scriptHash = addressToScriptHash(keys.address);
    logger.debug(`[Balance] User: ${userId}, Address: ${keys.address}, ScriptHash: ${scriptHash}`);

    const rate = await getBchToBrlRate();

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
        cache.set(cacheKey, balanceData, CACHE_TTL_BALANCE);
        return balanceData;
    } catch (error) {
        logger.error(`[Balance] Error fetching balance via racing for user ${userId} (Addr: ${keys.address}): ${error.message}`, error.stack);
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
        if (height > 0) {
             cache.set(cacheKey, height, CACHE_TTL_HEIGHT);
        }
        return height;
    } catch (error) {
        logger.error(`[Block Height] Failed to get block height via racing: ${error.message}`);
        throw new Error(`Failed to get current block height: ${error.message}`);
    }
}

// --- getWalletTransactions (Queries DB with pagination/filters) ---
async function getWalletTransactions(
    userId,
    page = 1,
    limit = 20,
    searchTerm = '',
    statusFilter = 'all',
    startDate = null,
    endDate = null
) {
    const skip = (page - 1) * limit;
    logger.info(`[History Service] Fetching transactions from DB for User: ${userId}, Page: ${page}, Limit: ${limit}, Search: '${searchTerm}', Status: ${statusFilter}, Start: ${startDate}, End: ${endDate}`);

    // No caching for paginated/filtered DB queries directly here,
    // as the underlying data (individual transactions) might be cached by SPV service or other parts.
    // Cache invalidation for such complex queries can be tricky.
    // If performance becomes an issue, consider caching specific common filter sets.

    try {
        const filterQuery = { userId: userId };

        if (searchTerm) {
            const searchRegex = { $regex: searchTerm, $options: 'i' };
            filterQuery.$or = [
                { txid: searchRegex },
                { address: searchRegex },
            ];
            logger.debug(`[History Query] Added search term filter: ${JSON.stringify(filterQuery.$or)}`);
        }

        if (statusFilter !== 'all') {
            if (statusFilter === 'confirmed') {
                filterQuery.confirmed = true;
            } else if (statusFilter === 'pending') {
                filterQuery.confirmed = false;
            }
            // Add more status filters if your Transaction model supports them (e.g., 'failed')
            logger.debug(`[History Query] Added status filter: ${statusFilter} -> ${JSON.stringify({ confirmed: filterQuery.confirmed })}`);
        }

        if (startDate || endDate) {
            filterQuery.timestamp = {};
            if (startDate) filterQuery.timestamp.$gte = new Date(startDate);
            if (endDate) filterQuery.timestamp.$lte = new Date(endDate);
            logger.debug(`[History Query] Added date filter: ${JSON.stringify(filterQuery.timestamp)}`);
        }

        logger.info(`[History] Fetching paginated results from DB. Query: ${JSON.stringify(filterQuery)}, Skip: ${skip}, Limit: ${limit}`);
        const [paginatedTransactions, totalCount] = await Promise.all([
             Transaction.find(filterQuery)
                .sort({ timestamp: -1 })
                .skip(skip)
                .limit(limit)
                .lean(),
             Transaction.countDocuments(filterQuery)
        ]);

        logger.debug(`[History] Data fetched from DB for page ${page}: ${paginatedTransactions.length} transactions.`);
        logger.info(`[History] Returning ${paginatedTransactions.length} transactions for page ${page}. Total count: ${totalCount}.`);

        return {
            transactions: paginatedTransactions,
            totalCount: totalCount,
            page: page,
            limit: limit,
            totalPages: Math.ceil(totalCount / limit)
        };

    } catch (error) {
        logger.error(`[History] Error fetching transactions from DB for user ${userId}: ${error.message}`, error.stack);
        throw new Error(`Failed to fetch transaction history. Please try again later.`);
    }
}
// --- END getWalletTransactions ---


// --- Send Transaction (Uses secure key retrieval) ---
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

// Internal function containing the original send logic
async function sendTransactionInternal(userId, recipientAddress, amountBchStr, feeLevel) {
    const keys = await getUserWalletKeys(userId);
    const fromAddress = keys.address;
    const wif = keys.wif;
    const amountBCH = parseFloat(amountBchStr);

    logger.info(`[Send TX Internal] User: ${userId}, From: ${fromAddress}, To: ${recipientAddress}, Amount: ${amountBchStr} BCH, FeeLevel: ${feeLevel}`);

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
        const scriptHash = addressToScriptHash(fromAddress);
        logger.debug(`[Send TX Internal] Fetching UTXOs for ${fromAddress} (SH: ${scriptHash})`);
        const utxosRaw = await electrumRequestManager.raceRequest('blockchain.scripthash.listunspent', [scriptHash]);

        if (!utxosRaw || utxosRaw.length === 0) {
            logger.warn(`[Send TX Internal] No UTXOs found for ${fromAddress}.`);
            throw new Error('Insufficient funds (no UTXOs found).');
        }
        logger.debug(`[Send TX Internal] Found ${utxosRaw.length} UTXOs.`);
        const utxos = utxosRaw.map(utxo => ({
            txid: utxo.tx_hash,
            vout: utxo.tx_pos,
            satoshis: utxo.value,
        }));

        const transactionBuilder = new bchjs.TransactionBuilder(network);
        let totalInputSatoshis = 0;
        utxos.forEach(utxo => {
            transactionBuilder.addInput(utxo.txid, utxo.vout);
            totalInputSatoshis += utxo.satoshis;
        });
        logger.debug(`[Send TX Internal] Total input value: ${totalInputSatoshis} satoshis from ${utxos.length} UTXOs.`);

        const preliminaryOutputCount = 2;
        const byteCountEstimate = bchjs.BitcoinCash.getByteCount({ P2PKH: utxos.length }, { P2PKH: preliminaryOutputCount });
        const feeEstimate = Math.ceil(byteCountEstimate * feeRateSatsPerByte);
        const changeAmountEstimate = totalInputSatoshis - amountSatoshis - feeEstimate;
        const needsChangeOutput = changeAmountEstimate >= DUST_THRESHOLD;

        const finalOutputCount = needsChangeOutput ? 2 : 1;
        const finalByteCount = bchjs.BitcoinCash.getByteCount({ P2PKH: utxos.length }, { P2PKH: finalOutputCount });
        const feeSatoshis = Math.ceil(finalByteCount * feeRateSatsPerByte);
        logger.debug(`[Send TX Internal] Estimated bytes: ${finalByteCount}, Final fee: ${feeSatoshis} satoshis. Needs change: ${needsChangeOutput}`);

        if (totalInputSatoshis < amountSatoshis + feeSatoshis) {
            logger.error(`[Send TX Internal] Insufficient funds. Required: ${amountSatoshis + feeSatoshis}, Available: ${totalInputSatoshis}`);
            throw new Error(`Insufficient funds. Required: ${amountSatoshis + feeSatoshis} satoshis, Available: ${totalInputSatoshis} satoshis.`);
        }

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

        const keyPair = bchjs.ECPair.fromWIF(wif);
        logger.debug(`[Send TX Internal] Signing ${utxos.length} inputs...`);
        utxos.forEach((utxo, index) => {
            transactionBuilder.sign(index, keyPair, undefined, transactionBuilder.hashTypes.SIGHASH_ALL, utxo.satoshis);
        });

        const tx = transactionBuilder.build();
        const txHex = tx.toHex();
        logger.debug(`[Send TX Internal] Transaction built. Hex length: ${txHex.length}`);

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
        throw new Error(`Failed to send transaction: ${error.message}`);
    }
}
// --- End Send Transaction ---

// --- Module Exports ---
module.exports = {
    getWalletAddress,
    getWalletBalance,
    getWalletTransactions,
    sendTransaction,
    saveTransactionIfNotExists, // Export the new function
    getBlockHeight, // Export getBlockHeight
    // getUserWalletKeys // Keep internal unless needed elsewhere
};
