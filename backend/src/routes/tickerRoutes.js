const express = require('express');
const { getBchBrl } = require('../controllers/tickerController');

const router = express.Router();

// Rota para obter o preço do BCH em BRL
router.get('/bchbrl', getBchBrl);

module.exports = router;