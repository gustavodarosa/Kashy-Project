// z:\Kashy-Project\backend\src\routes\statsRoutes.js
const express = require('express');
const router = express.Router();
const statsController = require('../controllers/statsController'); // We'll create this next
const { protect: authMiddleware } = require('../middlewares/authMiddleware'); // Import the protect function
const { query } = require('express-validator'); // For query param validation
const { validate } = require('../middlewares/validators'); // Import base validator
// Assuming you might create a validator schema later:
// const { salesOverTimeSchema } = require('../middlewares/validators/statsValidators');

// Apply auth middleware to all stat routes
router.use(authMiddleware); // Now correctly refers to the protect function

// GET /api/stats/sales-summary - Get overall sales summary (today, last 30 days, all time)
router.get('/sales-summary', statsController.getSalesSummary);

// GET /api/stats/sales-over-time - Get sales data grouped by period
router.get('/sales-over-time', [ query('groupBy').optional().isIn(['day', 'week', 'month']), query('days').optional().isInt({ min: 1, max: 365 }) ], statsController.getSalesOverTime);

module.exports = router;