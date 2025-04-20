const express = require('express');
const fetch = require('node-fetch');
const router = express.Router();

router.get('/market_chart', async (req, res) => {
  const { coin, currency, days, interval } = req.query;
  const url = `https://api.coingecko.com/api/v3/coins/${coin}/market_chart?vs_currency=${currency}&days=${days}&interval=${interval}`;

  try {
    const response = await fetch(url);
    if (!response.ok) {
      return res.status(response.status).json({ error: response.statusText });
    }
    const data = await response.json();
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: 'Erro ao buscar dados da API.' });
  }
});

module.exports = router;