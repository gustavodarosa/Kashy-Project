// z:/slaaa/Kashy-Project/backend/src/routes/rateRoutes.js
const express = require('express');
const router = express.Router();
const { getBchToBrlRate } = require('../services/exchangeRate'); // Adjust path if needed
const logger = require('../utils/logger'); // Assuming you have a logger

router.get('/bch-brl', async (req, res) => {
  try {
    const rate = await getBchToBrlRate();
    if (rate === null) {
      logger.error('[GET /api/rates/bch-brl] Failed to retrieve exchange rate from service.');
      return res.status(500).json({ message: 'Não foi possível obter a taxa de câmbio BCH/BRL.' });
    }
    res.json({ rate });
  } catch (error) {
    logger.error(`[GET /api/rates/bch-brl] Error fetching BCH/BRL rate: ${error.message}`);
    res.status(500).json({ message: 'Erro interno ao buscar a taxa de câmbio BCH/BRL.' });
  }
});

module.exports = router;
