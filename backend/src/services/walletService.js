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
const cryptoUtils = require('../utils/cryptoUtils'); // Uses AES-GCM now
// --- END MODIFICATION ---
// --- ADDED: Import Transaction model ---
const Transaction = require('../models/transaction');
// --- END ADDED ---
const mongoose = require('mongoose'); // Needed for ObjectId validation

const SATOSHIS_PER_BCH = 100_000_000;
const DUST_THRESHOLD = 546; // Dust threshold in satoshis
const MIN_RELAY_FEE_RATE = 1.0; // Minimum sats/byte for relay

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

// --- Helper: Address to ScriptHash (Keep as is) ---
/**
 * Converts a CashAddr address to its Electrum script hash.
 * @param {string} address - The CashAddr address (e.g., "bitcoincash:...")
 * @returns {string} The script hash in hexadecimal format.
 * @throws {Error} If the address type is unsupported or decoding fails.
 */
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

// --- MODIFICATION: Convert to Class ---
class WalletService {
    constructor(userId) {
        if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
            throw new Error("WalletService requires a valid userId");
        }
        this.userId = new mongoose.Types.ObjectId(userId); // Ensure it's an ObjectId
        this.user = null; // Lazy-loaded user data
        this.encryptionKey = process.env.ENCRYPTION_KEY;
        logger.debug(`[WalletService] Instantiated for userId: ${this.userId}`);
    }

    // --- Helper: Load User Data (Internal) ---
    async _loadUser(selectFields = '') {
        // Only load if not already loaded or if specific fields are needed that weren't loaded before
        if (!this.user || (selectFields && selectFields.split(' ').some(field => !this.user || !this.user.hasOwnProperty(field.replace('+', ''))))) {
            logger.debug(`[WalletService:${this.userId}] Loading user data with fields: '${selectFields || 'default'}'`);
            // Use lean() for performance if not modifying/saving the user object directly within the service method
            this.user = await User.findById(this.userId).select(selectFields).lean().exec();
            if (!this.user) {
                logger.error(`[WalletService:${this.userId}] User not found during load.`);
                throw new Error(`User not found: ${this.userId}`);
            }
        }
        return this.user;
    }

    // --- Helper: Get Decrypted Sensitive Data (Internal) ---
    async _getDecryptedData(fieldName, encryptedFieldName) {
        await this._loadUser(`+${encryptedFieldName}`); // Ensure the encrypted field is selected
        const encryptedData = this.user[encryptedFieldName];
        if (!encryptedData) {
            logger.error(`[WalletService:${this.userId}] Encrypted ${fieldName} not found for user.`);
            throw new Error(`Encrypted ${fieldName} not found for user.`);
        }
        if (!this.encryptionKey) {
            logger.error(`[WalletService:${this.userId}] ENCRYPTION_KEY not set.`);
            throw new Error("Server configuration error: Missing encryption key.");
        }
        try {
            // Use the decrypt function from cryptoUtils
            return cryptoUtils.decrypt(encryptedData, this.encryptionKey);
        } catch (error) {
            logger.error(`[WalletService:${this.userId}] Failed to decrypt ${fieldName}`, { error: error.message });
            // Throw a more specific error for easier catching in controllers
            throw new Error(`Failed to access or decrypt wallet ${fieldName}.`);
        }
    }

    // --- Get Wallet Address ---
    async getWalletAddress() {
        await this._loadUser('bchAddress'); // Ensure bchAddress is loaded
        if (!this.user.bchAddress) {
            logger.warn(`[WalletService:${this.userId}] BCH address not configured.`);
            throw new Error("BCH address not configured for this user.");
        }
        return this.user.bchAddress;
    }

    // --- Get Wallet Balance ---
    async getWalletBalance(skipBrlCalculation = false) { // Added skipBrlCalculation parameter
        const cacheKey = `balance:${this.userId}`;
        logger.debug(`[Balance] Checking cache for key: ${cacheKey}`);
        const cachedBalance = cache.get(cacheKey);
        if (cachedBalance !== undefined) {
            logger.debug(`[Balance] Cache HIT for ${this.userId}. Returning cached data.`);
            return cachedBalance;
        }

        logger.debug(`[Balance] Cache MISS for ${this.userId}. Fetching fresh balance...`);

        const address = await this.getWalletAddress();
        const scriptHash = addressToScriptHash(address);
        logger.debug(`[Balance] User: ${this.userId}, Address: ${address}, ScriptHash: ${scriptHash}`);

        let rate = 0;
        if (!skipBrlCalculation) {
            try {
                rate = await getBchToBrlRate(); // Rate is cached in its own service
            } catch (rateError) {
                logger.warn(`[Balance] Failed to get BRL rate for user ${this.userId}: ${rateError.message}. BRL values will be 0.`);
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
                // totalSatoshis, // Removed duplicate
                currentRateBRL: rate,
                fiatCurrency: 'BRL', // Or get from config/user settings
            };
            logger.info(`[Balance] Calculated balanceData for ${this.userId}: ${JSON.stringify(balanceData)}`);

            logger.debug(`[Balance] Setting cache for key: ${cacheKey}`);
            cache.set(cacheKey, balanceData, CACHE_TTL_BALANCE); // Cache the result
            return balanceData;
        } catch (error) {
            // Log the error stack for better debugging
            logger.error(`[Balance] Error fetching balance via racing for user ${this.userId} (Addr: ${address}): ${error.message}`, error.stack);
            // Re-throw a user-friendly error, potentially masking internal details
            throw new Error(`Failed to fetch wallet balance. Please try again later.`);
        }
    }

    // --- Get Wallet Transactions (Handles Syncing and Pagination) ---
    async getWalletTransactions(page = 1, limit = 20) {
        const skip = (page - 1) * limit;
        logger.info(`[History Service] Fetching transactions for User: ${this.userId}, Page: ${page}, Limit: ${limit}`);

        // 1. Sync Transactions (fetch from network, update/create in DB)
        // This step ensures the DB is up-to-date before querying it.
        await this.syncTransactions();

        // 2. Query DB for paginated results
        try {
            const [transactions, totalCount] = await Promise.all([
                Transaction.find({ userId: this.userId })
                    .sort({ timestamp: -1, createdAt: -1 }) // Sort by blockchain time, then creation time
                    .skip(skip)
                    .limit(limit)
                    .lean() // Use lean for performance
                    .exec(),
                Transaction.countDocuments({ userId: this.userId }).exec()
            ]);
            logger.info(`[History Service] Found ${transactions.length} transactions for page ${page} (Total: ${totalCount})`);
            return { transactions, totalCount };
        } catch (dbError) {
            logger.error(`[History Service] Error querying transactions from DB for user ${this.userId}`, { dbError: dbError.message });
            throw new Error(`Database error fetching transactions: ${dbError.message}`);
        }
    }

    // --- Send Transaction ---
    async sendTransaction(recipientAddress, amountBchStr, feeLevel) {
        logger.info(`[WalletService:${this.userId}] Initiating send`, { recipientAddress, amountBchStr, feeLevel });

        let txid = null;
        try {
            // 1. Validate Inputs (Basic - more detailed validation in bchService)
            if (!bitcore.Address.isValid(recipientAddress, network)) { // Use bitcore validation
                 logger.warn(`[WalletService:${this.userId}] Invalid recipient address format: ${recipientAddress}`);
                 throw new Error('Invalid recipient address format.');
            }
            const amountSat = Math.round(parseFloat(amountBchStr) * SATOSHIS_PER_BCH);
            if (isNaN(amountSat) || amountSat <= 0) {
                logger.warn(`[WalletService:${this.userId}] Invalid amount: ${amountBchStr}`);
                throw new Error('Invalid amount specified.');
            }
            if (amountSat < DUST_THRESHOLD) {
                 logger.warn(`[WalletService:${this.userId}] Amount ${amountSat} is below dust threshold ${DUST_THRESHOLD}`);
                 throw new Error(`Amount ${amountSat} is below dust threshold ${DUST_THRESHOLD}`);
            }

            // 2. Get necessary data (keys, sender address)
            let mnemonic, derivationPath, senderAddress, wif;
            try {
                // Fetch WIF and address using the secure method
                const keys = await this._getUserWalletKeysInternal(); // Use internal helper
                wif = keys.wif;
                senderAddress = keys.address;
            } catch (keyError) {
                // Error already logged in _getUserWalletKeysInternal
                throw new Error(`Failed to access or derive wallet keys: ${keyError.message}`); // Propagate error
            }

            // 3. Delegate actual broadcast and build to internal function
            const result = await this._sendTransactionInternal(wif, senderAddress, recipientAddress, amountBchStr, feeLevel);
            txid = result.txid;

            // 4. Invalidate cache on success
            logger.info(`[Send TX Success] Invalidating cache for user ${this.userId} after sending ${txid}`);
            cache.invalidateUserWalletCache(this.userId);
            cache.invalidateBlockHeightCache();

            // 5. Save sent transaction to DB (fire-and-forget)
            if (txid) {
                this._saveSentTransactionRecord(txid, recipientAddress, amountSat, feeLevel).catch(dbErr => {
                    logger.error(`[WalletService:${this.userId}] Failed to save 'sent' tx record to DB after successful broadcast`, { txid, dbError: dbErr.message });
                });
            }

            return { txid }; // Return only the txid on success

        } catch (sendError) {
            logger.error(`[WalletService:${this.userId}] Error during send transaction process`, { sendError: sendError.message, stack: sendError.stack });
            // Re-throw specific errors for controller handling
            if (sendError.message.includes('Insufficient funds')) throw new Error('Insufficient funds to cover the amount and transaction fee.');
            if (sendError.message.includes('Invalid recipient address')) throw new Error('Invalid recipient address.');
            if (sendError.message.includes('below dust threshold')) throw new Error('Transaction amount is too small (below dust threshold).');
            if (sendError.message.includes('Invalid amount')) throw new Error('Invalid amount specified.');
            if (sendError.message.includes('fee is too low')) throw new Error(sendError.message);
            if (sendError.message.includes('Network timeout')) throw new Error('Network timeout during transaction broadcast. Please check your transaction history later to confirm status.');
            if (sendError.message.includes('rejected by the network')) throw new Error(`Transaction rejected by the network: ${sendError.message}. Please check transaction details.`);
            if (sendError.message.includes('No connected Electrum servers')) throw new Error('Network error: Unable to connect to broadcast servers. Please try again later.');
            if (sendError.message.includes('broadcast may have failed')) throw sendError; // Pass specific broadcast error
            if (sendError.message.includes('Failed to access or derive wallet keys')) throw sendError; // Pass key error

            // Generic fallback
            throw new Error(`Failed to send transaction: ${sendError.message}`);
        }
    }

    // --- Internal Helper: Get User Wallet Keys ---
    // This duplicates the logic from the standalone function but uses class context
    async _getUserWalletKeysInternal() {
        logger.debug(`[WalletService:${this.userId}] Fetching keys internally...`);
        if (!this.encryptionKey) {
            logger.error(`[WalletService:${this.userId}] FATAL - ENCRYPTION_KEY is not set.`);
            throw new Error("Server configuration error preventing key access.");
        }
        try {
            await this._loadUser('+encryptedMnemonic +encryptedDerivationPath +bchAddress'); // Load necessary fields
            if (!this.user.encryptedMnemonic || !this.user.encryptedDerivationPath) {
                logger.error(`[WalletService:${this.userId}] User is missing encrypted wallet data.`);
                throw new Error('Encrypted wallet data not found for user.');
            }
            const mnemonic = cryptoUtils.decrypt(this.user.encryptedMnemonic, this.encryptionKey);
            const derivationPath = cryptoUtils.decrypt(this.user.encryptedDerivationPath, this.encryptionKey);
            const rootSeedBuffer = await bchjs.Mnemonic.toSeed(mnemonic);
            const masterHDNode = bchjs.HDNode.fromSeed(rootSeedBuffer, network);
            const childNode = masterHDNode.derivePath(derivationPath);
            const wif = bchjs.HDNode.toWIF(childNode);
            const address = bchjs.HDNode.toCashAddress(childNode);
            if (this.user.bchAddress && this.user.bchAddress !== address) {
                 logger.error(`[WalletService:${this.userId}] CRITICAL MISMATCH: Stored address ${this.user.bchAddress} != Derived address ${address}`);
                 throw new Error("Wallet data inconsistency detected. Please contact support.");
            } else if (!this.user.bchAddress) {
                 logger.warn(`[WalletService:${this.userId}] User was missing bchAddress in DB. Derived: ${address}.`);
            }
            logger.debug(`[WalletService:${this.userId}] Successfully derived keys internally.`);
            return { wif, address };
        } catch (error) {
            logger.error(`[WalletService:${this.userId}] Failed to get/derive keys internally: ${error.message}`);
            if (error.message.includes('inconsistency') || error.message.includes('Decryption failed')) {
                throw error;
            }
            throw new Error(`Failed to access or derive wallet keys.`);
        }
    }

    // --- Internal Helper: Send Transaction Logic ---
    async _sendTransactionInternal(wif, fromAddress, recipientAddress, amountBchStr, feeLevel) {
        const amountBCH = parseFloat(amountBchStr);
        const amountSatoshis = Math.round(amountBCH * SATOSHIS_PER_BCH);
        logger.info(`[Send TX Internal] From: ${fromAddress}, To: ${recipientAddress}, Amount: ${amountBchStr} BCH, FeeLevel: ${feeLevel}`);

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

            const minimumRequiredFee = Math.ceil(finalByteCount * MIN_RELAY_FEE_RATE);
            if (feeSatoshis < minimumRequiredFee) {
                logger.error(`[Send TX Internal] Calculated fee (${feeSatoshis}) is below minimum relay fee (${minimumRequiredFee}) for ${finalByteCount} bytes.`);
                throw new Error(`Calculated fee is too low. Minimum required: ${minimumRequiredFee} sats.`);
            }

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
            // Logged in the calling function (sendTransaction)
            throw error; // Re-throw to be caught by sendTransaction
        }
    }

    // --- Helper: Save Sent Transaction Record (Internal) ---
    async _saveSentTransactionRecord(txid, recipientAddress, amountSat, feeLevel) {
        // Fee calculation might happen in bchService or here if needed
        // For now, we don't have the exact fee, save without it or estimate
        // const feeSatoshis = await bchService.getEstimatedFee(feeLevel); // Example if bchService had this

        const newTx = new Transaction({
            userId: this.userId,
            txid: txid,
            type: 'sent',
            amount: parseFloat((amountSat / SATOSHIS_PER_BCH).toFixed(8)), // Store BCH amount
            recipientAddress: recipientAddress,
            // fee: feeSatoshis ? parseFloat((feeSatoshis / SATOSHIS_PER_BCH).toFixed(8)) : undefined, // Store fee in BCH if available (Needs fee calculation)
            // --- MODIFICATION: Set initial status fields ---
            status: 'pending', // Sent transactions start as pending
            confirmations: 0,
            blockHeight: -1,
            timestamp: new Date(), // Time of sending/broadcast attempt
            confirmed: false, // Keep boolean consistent
            // --- END MODIFICATION ---
            seen: true, // User initiated this action
            confirmed: false, // Explicitly false initially
            // convertedBRL: null, // BRL value usually applies to received sales
        });
        await newTx.save();
        logger.info(`[WalletService:${this.userId}] Saved pending 'sent' transaction record`, { txid });
    }

    // --- Check Transaction Integrity ---
    async checkTransactionIntegrity() {
        logger.info(`[WalletService:${this.userId}] Checking transaction integrity...`);
        try {
            // Fetch live balance (satoshi value needed) and DB transactions concurrently
            const [liveBalanceData, dbTransactions] = await Promise.all([
              this.getWalletBalance(true), // Pass flag to skip BRL calculation
              Transaction.find({ userId: this.userId }).lean()
            ]);

            // Calculate the net balance based *only* on confirmed received transactions stored in the DB
            let totalFromDbSatoshis = 0;
            logger.debug(`[Integrity Check] Calculating DB balance from confirmed 'received' transactions (${dbTransactions.length} total)...`);
            for (const tx of dbTransactions) {
                const txidShort = tx.txid.substring(0, 8);
                const txAmountBCH = typeof tx.amount === 'number' ? tx.amount : 0;
                const amountSat = Math.round(txAmountBCH * SATOSHIS_PER_BCH);

                // Only add confirmed received amounts to the total
                if (tx.type === 'received' && tx.confirmed) {
                    logger.debug(`[Integrity Check Loop] TX ${txidShort} (${tx.type}): Adding ${amountSat} sats. Prev total: ${totalFromDbSatoshis}`);
                    totalFromDbSatoshis += amountSat;
                }
            }

            // Compare against the *confirmed* live balance
            const liveConfirmedSatoshis = liveBalanceData.totalSatoshis?.confirmed ?? Math.round(liveBalanceData.availableBCH * SATOSHIS_PER_BCH);

            // Consistency check: Live confirmed balance should ideally match the sum of confirmed received transactions in the DB.
            const isConsistent = liveConfirmedSatoshis === totalFromDbSatoshis;

            logger.debug(`[Integrity Check] User ${this.userId}: Live Confirmed Sats = ${liveConfirmedSatoshis}, DB Sum of Confirmed Received Sats = ${totalFromDbSatoshis}. Consistent = ${isConsistent}`);
            return { isConsistent, onChainSatoshis: liveConfirmedSatoshis, dbCalculatedSatoshis: totalFromDbSatoshis };

          } catch (error) {
            logger.error(`[Integrity Check] Error checking integrity for user ${this.userId}: ${error.message}`, error.stack);
            throw new Error(`Failed to check wallet integrity: ${error.message}`); // Re-throw wrapped error
          }
    }

    // --- Sync Transactions (Core Logic) ---
    async syncTransactions() {
        const userAddress = await this.getWalletAddress();
        logger.info(`[WalletService:${this.userId}] Starting transaction sync for address ${userAddress}`);
        try {
            const scriptHash = addressToScriptHash(userAddress);
            let rate = 0;
            let currentHeight = 0;

            try { rate = await getBchToBrlRate(); } catch (rateError) { logger.warn(`[Sync] Failed to get BRL rate: ${rateError.message}.`); }
            try { currentHeight = await this._getBlockHeightInternal(); } catch (heightError) { logger.warn(`[Sync] Failed to get block height: ${heightError.message}.`); }

            logger.debug(`[Sync] Current Rate: ${rate}, Current Height: ${currentHeight}`);

            const history = await electrumRequestManager.raceRequest('blockchain.scripthash.get_history', [scriptHash]);

            if (!history || history.length === 0) {
                logger.info(`[Sync] No history found for ${userAddress}`);
                return;
            }
            logger.debug(`[Sync] Found ${history.length} history items. Fetching details (using cache)...`);

            const getTxDetailWithCache = async (txid, historyItemHeight) => { /* ... same as in getWalletTransactions ... */
                const txCacheKey = `tx:${txid}`;
                const cachedTx = cache.get(txCacheKey);
                if (cachedTx !== undefined) return cachedTx;
                logger.debug(`[Sync Detail Cache] Tx detail Cache MISS for ${txid}. Fetching...`);
                try {
                    const txDetail = await electrumRequestManager.raceRequest('blockchain.transaction.get', [txid, true]);
                    if (txDetail) {
                        const blockheight = txDetail.blockheight || (historyItemHeight > 0 ? historyItemHeight : null);
                        const confirmations = blockheight && currentHeight > 0 ? currentHeight - blockheight + 1 : 0;
                        const ttl = confirmations > 0 ? CACHE_TTL_TX_DETAIL_CONFIRMED : CACHE_TTL_TX_DETAIL_UNCONFIRMED;
                        logger.debug(`[Sync Detail Cache] Setting cache for ${txid} with TTL: ${ttl}s`);
                        cache.set(txCacheKey, txDetail, ttl);
                    } else { logger.warn(`[Sync Detail] Received null/empty detail for ${txid}.`); }
                    return txDetail;
                } catch (err) { logger.error(`[Sync Detail] Failed fetching/caching details for ${txid}: ${err.message}`); return null; }
            };

            const detailPromises = history.map(item => getTxDetailWithCache(item.tx_hash, item.height));
            const transactionDetailsList = await Promise.all(detailPromises);

            const neededPrevOutputs = new Map();
            transactionDetailsList.forEach(txDetails => { /* ... same as in getWalletTransactions ... */
                if (!txDetails) return;
                txDetails.vin.forEach(vin => {
                    if (vin.coinbase || !vin.txid || vin.vout === undefined) return;
                    const key = `${vin.txid}:${vin.vout}`;
                    if (!neededPrevOutputs.has(key)) neededPrevOutputs.set(key, null);
                });
            });

            if (neededPrevOutputs.size > 0) { /* ... same as in getWalletTransactions ... */
                logger.debug(`[Sync] Need details for ${neededPrevOutputs.size} previous outputs. Fetching...`);
                const uniquePrevTxids = [...new Set([...neededPrevOutputs.keys()].map(key => key.split(':')[0]))];
                const prevTxDetailPromises = uniquePrevTxids.map(txid => getTxDetailWithCache(txid, 0)); // Pass 0 height
                const prevTransactionDetailsList = await Promise.all(prevTxDetailPromises);
                const prevTxDetailsMap = new Map(prevTransactionDetailsList.filter(d => d).map(d => [d.txid, d]));
                neededPrevOutputs.forEach((_, key) => {
                    const [txid, voutStr] = key.split(':'); const voutIndex = parseInt(voutStr, 10);
                    const prevTx = prevTxDetailsMap.get(txid);
                    if (prevTx?.vout?.[voutIndex]) neededPrevOutputs.set(key, prevTx.vout[voutIndex]);
                    else logger.warn(`[Sync Prev Detail] Could not find vout ${voutIndex} for prev tx ${txid}`);
                });
                logger.debug(`[Sync] Mapped prev output details.`);
            }

            const bulkOps = [];
            history.forEach((item, index) => {
                const txDetails = transactionDetailsList[index];
                if (!txDetails) return;
                try {
                    const txid = item.tx_hash;
                    const blockHeight = item.height > 0 ? item.height : -1; // Use -1 for pending
                    const confirmations = blockHeight > 0 && currentHeight > 0 ? currentHeight - blockHeight + 1 : 0;
                    const status = confirmations > 0 ? 'confirmed' : 'pending';
                    const blockTimestamp = txDetails.blocktime ? new Date(txDetails.blocktime * 1000) : null;
                    const serverReceivedTime = txDetails.time ? new Date(txDetails.time * 1000) : null;
                    const timestamp = blockTimestamp || serverReceivedTime || new Date(); // Fallback to now
                    const feeSatoshis = txDetails.fees ? Math.round(txDetails.fees * SATOSHIS_PER_BCH) : 0;

                    let totalSpentByUser = 0, totalReceivedByUser = 0, firstOtherRecipientAddress = null, amountSentToOthers = 0, userInputsInTx = false;
                    for (const vin of txDetails.vin) { /* ... same input analysis ... */
                        if (vin.coinbase || !vin.txid || vin.vout === undefined) continue;
                        const key = `${vin.txid}:${vin.vout}`; const prevOutputDetail = neededPrevOutputs.get(key);
                        if (prevOutputDetail) {
                            const inputValueSat = prevOutputDetail.valueSat ?? Math.round((prevOutputDetail.value || 0) * SATOSHIS_PER_BCH);
                            const prevAddr = prevOutputDetail.scriptPubKey?.addresses?.[0];
                            if (prevAddr === userAddress) { totalSpentByUser += inputValueSat; userInputsInTx = true; }
                        } else { logger.error(`[Sync Process - Input] CRITICAL: Missing prev output detail for ${key} in tx ${txid}.`); }
                    }
                    for (const vout of txDetails.vout) { /* ... same output analysis ... */
                        const outputValueSat = vout.valueSat ?? Math.round((vout.value || 0) * SATOSHIS_PER_BCH);
                        const outputAddr = vout.scriptPubKey?.addresses?.[0];
                        if (outputAddr === userAddress) totalReceivedByUser += outputValueSat;
                        else if (outputAddr) { amountSentToOthers += outputValueSat; firstOtherRecipientAddress = firstOtherRecipientAddress || outputAddr; }
                    }

                    const netSatoshisChange = totalReceivedByUser - totalSpentByUser;
                    let type = 'unknown', amountSatoshis = 0, displayAddress = 'N/A';
                    if (netSatoshisChange > 0 && !userInputsInTx) { type = 'received'; amountSatoshis = netSatoshisChange; displayAddress = userAddress; }
                    else if (netSatoshisChange < 0 && userInputsInTx) { type = 'sent'; amountSatoshis = amountSentToOthers; displayAddress = firstOtherRecipientAddress || 'Multiple Recipients'; }
                    else if (netSatoshisChange === -feeSatoshis && userInputsInTx && amountSentToOthers === 0) { type = 'sent'; amountSatoshis = 0; displayAddress = userAddress; }
                    else { logger.warn(`[Sync Process] Complex/Unknown TX type ${txid}.`); type = 'unknown'; amountSatoshis = 0; displayAddress = 'Complex Interaction'; }

                    if (amountSatoshis < 0) amountSatoshis = 0;
                    const amountBCH = parseFloat((amountSatoshis / SATOSHIS_PER_BCH).toFixed(8));
                    const amountBRL = rate > 0 ? amountBCH * rate : 0;
                    const feeBCH = (type === 'sent') ? parseFloat((feeSatoshis / SATOSHIS_PER_BCH).toFixed(8)) : undefined;

                    const updateData = {
                        userId: this.userId,
                        address: displayAddress, // Use the determined display address
                        txid: txid,
                        amount: amountBCH, // Store BCH amount
                        type: type, // 'sent' or 'received'
                        timestamp: timestamp,
                        // --- MODIFICATION: Set status fields from sync data ---
                        status: status, // 'pending' or 'confirmed'
                        confirmations: confirmations,
                        blockHeight: blockHeight,
                        confirmed: status === 'confirmed', // Keep boolean consistent
                        // --- END MODIFICATION ---
                        convertedBRL: amountBRL,
                        fee: feeBCH, // Store fee if sent
                        // 'seen' status is handled separately or on creation
                    };

                    bulkOps.push({
                        updateOne: {
                            filter: { userId: this.userId, txid: txid },
                            update: { $set: updateData, $setOnInsert: { seen: (type === 'sent') } }, // Set 'seen' only on insert
                            upsert: true // Insert if not found, update if found
                        }
                    });
                    logger.debug(`[Sync] Queued upsert for txid ${txid}`);

                } catch (procError) { logger.error(`[Sync Process] Error processing tx ${item.tx_hash}: ${procError.message}`, procError.stack); }
            }); // End history.forEach

            if (bulkOps.length > 0) {
                logger.info(`[Sync] Executing ${bulkOps.length} bulk DB operations for user ${this.userId}...`);
                await Transaction.bulkWrite(bulkOps, { ordered: false });
                logger.info(`[Sync] Bulk DB operations completed for user ${this.userId}.`);
            } else {
                logger.info(`[Sync] No DB updates needed for user ${this.userId}.`);
            }

            logger.info(`[WalletService:${this.userId}] Transaction sync completed for address ${userAddress}`);

        } catch (error) {
            logger.error(`[WalletService:${this.userId}] Error during transaction sync for address ${userAddress}`, { error: error.message, stack: error.stack });
            // Don't throw error here, sync failure shouldn't block other operations, just log it.
        }
    }

    // --- Internal Helper: Get Block Height ---
    async _getBlockHeightInternal() {
        const cacheKey = 'blockHeight';
        const cachedHeight = cache.get(cacheKey);
        if (cachedHeight !== undefined) return cachedHeight;
        logger.debug(`[Block Height Internal] Fetching via racing - Cache MISS`);
        try {
            const headerResult = await electrumRequestManager.raceRequest('blockchain.headers.subscribe', []);
            const height = headerResult?.height || 0;
            if (height > 0) cache.set(cacheKey, height, CACHE_TTL_HEIGHT);
            return height;
        } catch (error) {
            logger.error(`[Block Height Internal] Failed: ${error.message}`);
            throw new Error(`Failed to get current block height: ${error.message}`);
        }
    }

    // --- Mark Transaction As Seen ---
    async markTransactionAsSeen(txid) {
        logger.info(`[WalletService:${this.userId}] Marking transaction as seen`, { txid });
        try {
            const tx = await Transaction.findOneAndUpdate(
                { txid: txid, userId: this.userId }, // Match both txid and userId
                { $set: { seen: true } },
                { new: true } // Return the updated document
            ).lean();

            if (!tx) {
                logger.warn(`[WalletService:${this.userId}] Transaction not found or access denied`, { txid });
                // Throw specific error for controller
                throw new Error('Transaction not found or access denied.');
            }
            logger.info(`[WalletService:${this.userId}] Successfully marked transaction as seen`, { txid });
            return tx; // Return the updated transaction
        } catch (dbError) {
            logger.error(`[WalletService:${this.userId}] Error marking transaction as seen in DB`, { txid, dbError: dbError.message });
            // Re-throw if it wasn't the 'not found' error
            if (!dbError.message.includes('not found')) {
                throw new Error(`Database error marking transaction as seen: ${dbError.message}`);
            }
            throw dbError; // Re-throw the original error (e.g., 'not found')
        }
    }
}
// --- END MODIFICATION ---

module.exports = WalletService; // Export the class
