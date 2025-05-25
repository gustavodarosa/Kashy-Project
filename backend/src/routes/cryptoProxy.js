const express = require('express');
const fetch = require('node-fetch');
const router = express.Router();
const logger = require('../utils/logger'); // Assuming a logger is available

const BINANCE_API_BASE_URL = 'https://api.binance.com';
const SYMBOL = 'BCHUSDT'; // Target symbol for Binance

const cache = {
  currentPrice: new Map(), // key: binance:ticker:SYMBOL
  priceHistory: new Map(), // key: binance:klines:SYMBOL:days:interval
};

const TTL_PRICE_MS = 2 * 60 * 1000;    // 2 minutes
const TTL_HISTORY_MS = 5 * 60 * 1000;  // 5 minutes

// Função de cache
const setCache = (type, key, data, ttl) => {
  cache[type].set(key, { data, expires: Date.now() + ttl });
};

const getCache = (type, key) => {
  const entry = cache[type].get(key);
  if (entry && Date.now() < entry.expires) {
    // logger.debug(`[CryptoProxy] Cache hit for ${type} key: ${key}`);
    return entry.data;
  } else {
    if (entry) {
      // logger.debug(`[CryptoProxy] Cache expired/removed for ${type} key: ${key}`);
      cache[type].delete(key); // Remove expired
    }
    return null;
  }
};

router.get('/bch-price-data', async (req, res) => {
  // const coinId = 'bitcoin-cash'; // Kept for conceptual mapping, but SYMBOL is used for Binance
  // const vsCurrency = 'usd';     // Kept for conceptual mapping

  const days = parseInt(req.query.days || '7', 10);
  const requestedInterval = req.query.interval || 'daily'; // e.g., '15m', '1h', '4h', 'daily', '1d' from frontend

  let binanceInterval;
  let limit;

  // Map frontend interval to Binance interval and calculate limit
  switch (requestedInterval) {
    case '15m': binanceInterval = '15m'; limit = days * 24 * 4; break; // For 1 day, 96 points
    case '30m': binanceInterval = '30m'; limit = days * 24 * 2; break;
    case '1h': binanceInterval = '1h'; limit = days * 24; break;    // For 1 day, 24 points
    case '2h': binanceInterval = '2h'; limit = days * 12; break;
    case '4h': binanceInterval = '4h'; limit = days * 6; break;
    case '1d': // This is when frontend sends 'Diário' for 1-day view
    case 'daily': // This is for 7d, 14d, 30d views
    default: binanceInterval = '1d'; limit = days; break;
  }

  // Binance has a max limit of 1000 for klines.
  if (limit > 1000) {
    logger.warn(`[CryptoProxy] Calculated limit ${limit} for ${days} days / ${requestedInterval} interval exceeds Binance max of 1000. Capping at 1000.`);
    limit = 1000;
  }

  const currentPriceKey = `binance:ticker:${SYMBOL}`;
  const historyKey = `binance:klines:${SYMBOL}:${days}d:${binanceInterval}`; // Adjusted key format

  // Use Binance API endpoint for 24hr ticker statistics for current price
  const currentPriceUrl = `${BINANCE_API_BASE_URL}/api/v3/ticker/24hr?symbol=${SYMBOL}`;
  const priceHistoryUrl = `${BINANCE_API_BASE_URL}/api/v3/klines?symbol=${SYMBOL}&interval=${binanceInterval}&limit=${limit}`;

  try {
    // --- FETCH CURRENT PRICE ---
    let currentPrice = getCache('currentPrice', currentPriceKey);
    if (!currentPrice) {
      logger.info(`[CryptoProxy] Cache miss for current price. Fetching from: ${currentPriceUrl}`);
      const response = await fetch(currentPriceUrl, { timeout: 10000 }); // Added timeout
      if (!response.ok) {
        const errorBody = await response.text();
        throw new Error(`Erro ao buscar preço atual da Binance API (${response.status}): ${errorBody}`);
      }
      const data = await response.json();
      const lastPrice = parseFloat(data.lastPrice);

      if (isNaN(lastPrice)) {
        throw new Error(`Formato de preço inválido recebido da Binance API para ${SYMBOL}. Data: ${JSON.stringify(data)}`);
      }
      currentPrice = lastPrice;
      setCache('currentPrice', currentPriceKey, currentPrice, TTL_PRICE_MS);
      logger.info(`[CryptoProxy] Current price for ${SYMBOL} fetched from Binance and cached: ${currentPrice}`);
    } else {
      logger.info(`[CryptoProxy] Current price for ${SYMBOL} served from Binance cache.`);
    }

    // --- FETCH PRICE HISTORY ---
    let priceHistory = getCache('priceHistory', historyKey);
    if (!priceHistory) {
      logger.info(`[CryptoProxy] Cache miss for price history. Fetching from: ${priceHistoryUrl}`);
      const response = await fetch(priceHistoryUrl, { timeout: 15000 }); // Added timeout
      if (!response.ok) {
        const errorBody = await response.text();
        throw new Error(`Erro ao buscar histórico de preços (klines) da Binance API (${response.status}): ${errorBody}`);
      }
      const data = await response.json(); // Binance klines returns an array of arrays
      if (!Array.isArray(data) || (data.length > 0 && !Array.isArray(data[0]))) {
        throw new Error(`Formato de resposta inválido para o histórico de preços (klines) da Binance API para ${SYMBOL}. Data: ${JSON.stringify(data)}`);
      }
      // Binance kline format: [Open time, Open, High, Low, Close, Volume, ...]
      // We need: [{ timestamp, price (close price) }]
      priceHistory = data.map(kline => ({
        timestamp: new Date(kline[0]).toISOString(), // kline[0] is Open time
        price: parseFloat(kline[4]),                 // kline[4] is Close price
      }));
      setCache('priceHistory', historyKey, priceHistory, TTL_HISTORY_MS);
      logger.info(`[CryptoProxy] Price history for ${SYMBOL} (days: ${days}, interval: ${binanceInterval}, limit: ${limit}) fetched from Binance and cached.`);
    } else {
      logger.info(`[CryptoProxy] Price history for ${SYMBOL} (days: ${days}, interval: ${binanceInterval}, limit: ${limit}) served from Binance cache.`);
    }

    res.json({ currentPrice, priceHistory });

  } catch (err) {
    logger.error(`[CryptoProxy] Erro ao processar /bch-price-data: ${err.message}`, { stack: err.stack });

    // Attempt to serve from cache as a fallback
    const fallbackPrice = getCache('currentPrice', currentPriceKey);
    const fallbackHistory = getCache('priceHistory', historyKey);

    if (fallbackPrice && fallbackHistory) {
      logger.warn(`[CryptoProxy] Servindo dados de fallback do cache para /bch-price-data devido a erro: ${err.message}`);
      return res.status(200).json({
        currentPrice: fallbackPrice,
        priceHistory: fallbackHistory,
        fallback: true
      });
    }

    res.status(500).json({ error: `Erro ao buscar dados da Binance API e nenhum cache de fallback completo disponível. Detalhe: ${err.message}` });
  }
});

module.exports = router;
