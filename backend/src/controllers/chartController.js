// c:\Users\gustavo.rosa8\Desktop\Kashy-Project\backend\src\controllers\chartController.js
const chartService = require('../services/chartService');
const logger = require('../utils/logger');

/**
 * GET /api/chart/:coinId/:vsCurrency
 * Fetches market chart data for a specific coin.
 */
async function getMarketChart(req, res) {
    const { coinId, vsCurrency } = req.params;
    const days = req.query.days || '1'; // Default to 1 day if not specified
    const endpoint = `[GET /api/chart/${coinId}/${vsCurrency}]`;

    logger.info(`${endpoint} Request received. Days: ${days}`);

    try {
        const chartData = await chartService.getCoinMarketChart(coinId, vsCurrency, days);
        res.status(200).json(chartData);
        logger.info(`${endpoint} Successfully sent chart data.`);
    } catch (error) {
        logger.error(`${endpoint} Error fetching chart data: ${error.message}`);
        res.status(500).json({ message: error.message || 'Internal server error fetching chart data.' });
    }
}

module.exports = {
    getMarketChart,
};