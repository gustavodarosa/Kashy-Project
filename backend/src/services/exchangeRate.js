// z:\Kashy-Project\backend\src\services\exchangeRate.js

// Use CommonJS require syntax
const axios = require('axios');
// Assuming logger is in utils/logger.js
const logger = require('../utils/logger');
// Assuming config is not directly needed here, but logger might use it

const CACHE_DURATION_MS = 5 * 60 * 1000; // 5 minutes
const COINGECKO_URL = 'https://api.coingecko.com/api/v3/simple/price?ids=bitcoin-cash&vs_currencies=brl';

let currentRate = null; // Initialize as null
let lastUpdated = 0;

/**
 * Fetches the BCH/BRL exchange rate from CoinGecko API.
 * Caches the result for CACHE_DURATION_MS.
 * @returns {Promise<number>} The current BCH to BRL exchange rate.
 */
async function fetchRate() {
  try {
    logger.info('Fetching fresh BCH/BRL rate from CoinGecko...');
    const response = await axios.get(COINGECKO_URL);
    // Use optional chaining and nullish coalescing for safety
    const rate = response?.data?.['bitcoin-cash']?.brl;

    // Validate the fetched rate
    if (typeof rate !== 'number' || rate <= 0) {
      // Log the invalid data received for debugging
      logger.error(`Invalid rate received from CoinGecko API. Data: ${JSON.stringify(response?.data)}`);
      throw new Error('Invalid rate received from API');
    }

    currentRate = rate;
    lastUpdated = Date.now();
    logger.info(`Fetched new rate: ${rate} BRL/BCH`);
    return rate;
  } catch (error) {
    // Log the specific error from axios or validation
    logger.error(`Failed to fetch BCH/BRL rate: ${error.message}`);
    // Return stale rate if available, otherwise re-throw a more specific error
    if (currentRate) {
      logger.warn('Returning stale rate due to fetch error.');
      return currentRate;
    }
    // Re-throw if no cached rate is available
    throw new Error(`Could not fetch exchange rate: ${error.message}`);
  }
}

/**
 * Gets the BCH/BRL exchange rate, using cache if available and not expired.
 * @returns {Promise<number>} The BCH to BRL exchange rate.
 */
async function getBchToBrlRate() {
  const now = Date.now();
  // Check if cache is valid
  if (currentRate !== null && (now - lastUpdated < CACHE_DURATION_MS)) {
    // logger.debug('Returning cached BCH/BRL rate.'); // Optional debug log
    return currentRate;
  }
  // Fetch fresh rate if cache is invalid or expired
  return fetchRate();
}

// Initial fetch on startup
// Use .then() and .catch() for the initial call as it's top-level async
fetchRate()
  .then(rate => logger.info(`Initial BCH/BRL rate fetched successfully: ${rate}`))
  .catch(err => logger.error(`Initial rate fetch failed: ${err.message}`));

// Optional: Periodic refresh
const refreshInterval = setInterval(fetchRate, CACHE_DURATION_MS);

// Optional: Add graceful shutdown logic if needed (e.g., clear interval)
// process.on('SIGTERM', () => clearInterval(refreshInterval));
// process.on('SIGINT', () => clearInterval(refreshInterval));

// Use module.exports for CommonJS export
module.exports = {
  getBchToBrlRate,
  // fetchRate // Optionally export fetchRate if needed directly elsewhere
};
