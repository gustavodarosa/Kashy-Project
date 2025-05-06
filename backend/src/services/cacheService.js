// src/services/cacheService.js
const NodeCache = require('node-cache');
const logger = require('../utils/logger'); // Assuming logger path

// stdTTL: default time-to-live in seconds for cache items (0 = infinite)
// checkperiod: interval in seconds to check for expired items
// useClones: false - Important for performance if you don't modify cached objects directly
const cache = new NodeCache({ stdTTL: 60, checkperiod: 120, useClones: false });

logger.info('Cache service initialized (node-cache)');

/**
 * Get a value from the cache.
 * @param {string} key Cache key
 * @returns {any | undefined} Cached value or undefined if not found/expired
 */
function get(key) {
    const value = cache.get(key);
    if (value !== undefined) { // Check explicitly for undefined, as null/0 might be valid cached values
        logger.debug(`[Cache HIT] Key: ${key}`);
        return value;
    }
    logger.debug(`[Cache MISS] Key: ${key}`);
    return undefined;
}

/**
 * Set a value in the cache.
 * @param {string} key Cache key
 * @param {any} value Value to cache
 * @param {number} [ttl] Optional TTL in seconds for this specific key
 */
function set(key, value, ttl) {
    // Ensure value is not undefined before setting
    if (value === undefined) {
        logger.warn(`[Cache SET Attempt] Tried to set undefined value for key: ${key}. Skipping.`);
        return;
    }

    if (ttl !== undefined) {
        cache.set(key, value, ttl);
        logger.debug(`[Cache SET] Key: ${key}, TTL: ${ttl}s`);
    } else {
        cache.set(key, value); // Use standard TTL
        logger.debug(`[Cache SET] Key: ${key}, TTL: default (${cache.options.stdTTL}s)`);
    }
}

/**
 * Delete a key or multiple keys from the cache.
 * @param {string | string[]} key Cache key(s) to delete
 * @returns {number} Number of keys deleted
 */
function del(key) {
    const deletedCount = cache.del(key);
    if (deletedCount > 0) {
         logger.debug(`[Cache DEL] Key(s): ${Array.isArray(key) ? key.join(', ') : key} (${deletedCount} deleted)`);
    }
    return deletedCount;
}

/**
 * Flush the entire cache.
 */
function flush() {
    cache.flushAll();
    logger.info('[Cache FLUSH] All cache cleared.');
}

/**
 * Invalidates cache entries related to a specific user's wallet data.
 * Called when a change is detected (new tx via SPV, or after sending).
 * @param {string} userId
 */
function invalidateUserWalletCache(userId) {
    if (!userId) return 0;
    const userIdStr = userId.toString(); // Ensure string format
    const keysToDelete = [
        `balance:${userIdStr}`,
        `history:${userIdStr}`,
        // Add other user-specific keys if needed (e.g., `utxos:${userIdStr}` if you cache UTXOs)
    ];
    logger.info(`[Cache Invalidate] Invalidating wallet cache for User: ${userIdStr}`);
    return del(keysToDelete);
}

/**
 * Invalidates the cache for a specific transaction detail.
 * Useful if an unconfirmed transaction needs re-fetching.
 * @param {string} txid
 */
function invalidateTxDetailCache(txid) {
    if (!txid) return 0;
    const key = `tx:${txid}`;
    logger.info(`[Cache Invalidate] Invalidating TX detail cache for: ${txid}`);
    return del(key);
}

/**
 * Invalidates the block height cache.
 */
function invalidateBlockHeightCache() {
    logger.info(`[Cache Invalidate] Invalidating block height cache.`);
    return del('blockHeight');
}


module.exports = {
    get,
    set,
    del,
    flush,
    invalidateUserWalletCache,
    invalidateTxDetailCache,
    invalidateBlockHeightCache
};
