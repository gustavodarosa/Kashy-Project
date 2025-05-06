// z:\Kashy-Project\backend\src\routes\cryptoProxy.js
const express = require('express');
const fetch = require('node-fetch');
const router = express.Router();
// Import node-cache
const NodeCache = require('node-cache');
// Import the authentication middleware
const { protect: authMiddleware } = require('../middlewares/authMiddleware'); // Adjust path if needed

// Initialize cache with a standard TTL (e.g., 60 seconds)
const cryptoCache = new NodeCache({ stdTTL: 60 });

// Apply authentication middleware to all routes in this file
router.use(authMiddleware);

router.get('/market_chart', async (req, res) => {
  // User is authenticated at this point thanks to the middleware
  const { coin, currency, days, interval } = req.query;

  // Create a unique cache key based on query parameters
  const cacheKey = `market_chart_${coin}_${currency}_${days}_${interval || 'default'}`;

  // Construct the URL for the external API
  // Ensure required query params are present (optional, but good practice)
  if (!coin || !currency || !days) {
      return res.status(400).json({ error: 'Missing required query parameters: coin, currency, days' });
  }
  // Build the URL, adding interval only if provided
  let url = `https://api.coingecko.com/api/v3/coins/${coin}/market_chart?vs_currency=${currency}&days=${days}`;
  if (interval) {
      url += `&interval=${interval}`;
  }

  try {
    // Check cache first
    const cachedData = cryptoCache.get(cacheKey);
    if (cachedData) {
      console.log(`Cache hit for ${cacheKey}`);
      return res.json(cachedData);
    }
    console.log(`Cache miss for ${cacheKey}, fetching from CoinGecko...`);
    // Fetch data from CoinGecko
    const response = await fetch(url);
    if (!response.ok) {
      // Forward CoinGecko's error status and text if possible
      const errorBody = await response.text();
      console.error(`CoinGecko API Error (${response.status}): ${errorBody}`);
      return res.status(response.status).json({ error: `CoinGecko API Error: ${response.statusText}` });
    }
    const data = await response.json();
    // Send CoinGecko's data back to the client
    // Store successful response in cache
    cryptoCache.set(cacheKey, data);
    res.json(data);
  } catch (error) {
    // Handle network errors or issues fetching from CoinGecko
    console.error("Error fetching from CoinGecko:", error); // Log the actual error
    res.status(500).json({ error: 'Erro ao buscar dados da API externa.' }); // More specific error message
  }
});

module.exports = router;
