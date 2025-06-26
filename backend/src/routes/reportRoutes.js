const express = require('express');
const router = express.Router();
const { generateReport } = require('../controllers/reportController');
const { protect } = require('../middlewares/authMiddleware'); // Importe seu middleware de proteção

// @route   GET /api/reports
// @desc    Generate dynamic reports
// @access  Private
router.get('/', protect, generateReport);

module.exports = router;