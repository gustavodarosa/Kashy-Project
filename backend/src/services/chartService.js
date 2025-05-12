// c:\Users\gustavo.rosa8\Desktop\Kashy-Project\backend\src\services\chartService.js
const axios = require('axios');
const logger = require('../utils/logger');
const cache = require('./cacheService'); // Opcional: Adicionar cache

const COINGECKO_API_URL = 'https://api.coingecko.com/api/v3';
const CACHE_TTL_CHART = 60 * 5; // Cache chart data for 5 minutes

/**
 * Fetches historical market chart data for a specific coin from CoinGecko.
 * @param {string} coinId - The CoinGecko ID of the coin (e.g., 'bitcoin-cash').
 * @param {string} vsCurrency - The currency to compare against (e.g., 'usd', 'brl').
 * @param {string} days - The number of days of data to fetch (e.g., '1', '7', '30').
 * @returns {Promise<object>} - The chart data from CoinGecko.
 */
async function getCoinMarketChart(coinId, vsCurrency, days) {
    const cacheKey = `chart:${coinId}:${vsCurrency}:${days}`;
    const cachedData = cache.get(cacheKey);
    if (cachedData) {
        logger.debug(`[Chart Service] Cache HIT for ${cacheKey}`);
        return cachedData;
    }

    logger.debug(`[Chart Service] Cache MISS for ${cacheKey}. Fetching from CoinGecko...`);
    const url = `${COINGECKO_API_URL}/coins/${coinId}/market_chart?vs_currency=${vsCurrency}&days=${days}`;

    try {
        const response = await axios.get(url);
        logger.info(`[Chart Service] Successfully fetched chart data for ${coinId} (${days} days)`);
        cache.set(cacheKey, response.data, CACHE_TTL_CHART); // Cache the result
        return response.data;
    } catch (error) {
        logger.error(`[Chart Service] Error fetching chart data from CoinGecko for ${coinId}: ${error.message}`);
        throw new Error('Failed to fetch chart data from external source.');
    }
}

module.exports = {
    getCoinMarketChart,
};