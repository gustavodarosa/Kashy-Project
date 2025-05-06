// z:\Kashy-Project\backend\src\controllers\statsController.js
const Transaction = require('../models/transaction');
const mongoose = require('mongoose');
const logger = require('../utils/logger');
const { validationResult } = require('express-validator');
// const { getBRLPrice } = require('../services/priceService'); // If needed for current price display

async function getSalesSummary(req, res) {
    const endpoint = '/api/stats/sales-summary (GET)';
    const userId = req.userId;
    if (!userId) return res.status(401).json({ message: 'User not identified' }); // Should be caught by middleware
    logger.info(`[${endpoint}] Fetching sales summary`, { userId });

    try {
        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);

        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        thirtyDaysAgo.setHours(0, 0, 0, 0);

        const summaryPipeline = [
            {
                $match: {
                    userId: new mongoose.Types.ObjectId(userId),
                    type: 'received', // Count sales
                    status: 'confirmed', // Only confirmed sales count towards totals usually
                }
            },
            {
                $facet: {
                    allTime: [
                        { $group: { _id: null, totalBRL: { $sum: '$convertedBRL' }, totalBCH: { $sum: '$amount' }, count: { $sum: 1 } } }
                    ],
                    last30Days: [
                        { $match: { timestamp: { $gte: thirtyDaysAgo } } },
                        { $group: { _id: null, totalBRL: { $sum: '$convertedBRL' }, totalBCH: { $sum: '$amount' }, count: { $sum: 1 } } }
                    ],
                    today: [
                        { $match: { timestamp: { $gte: todayStart } } },
                        { $group: { _id: null, totalBRL: { $sum: '$convertedBRL' }, totalBCH: { $sum: '$amount' }, count: { $sum: 1 } } }
                    ]
                }
            }
        ];

        const result = await Transaction.aggregate(summaryPipeline);

        // Helper to safely extract faceted results
        const extract = (facetResult) => ({
            totalBRL: facetResult?.[0]?.totalBRL || 0,
            totalBCH: facetResult?.[0]?.totalBCH || 0, // Assuming 'amount' field stores BCH
            count: facetResult?.[0]?.count || 0,
        });

        const allTimeStats = extract(result[0].allTime);
        const last30DaysStats = extract(result[0].last30Days);
        const todayStats = extract(result[0].today);

        // Calculate averages (per transaction, not per customer due to anonymity)
        const calculateAvg = (stats) => stats.count > 0 ? (stats.totalBRL / stats.count) : 0;

        const summary = {
            allTime: { ...allTimeStats, averageTicketBRL: calculateAvg(allTimeStats) },
            last30Days: { ...last30DaysStats, averageTicketBRL: calculateAvg(last30DaysStats) },
            today: { ...todayStats, averageTicketBRL: calculateAvg(todayStats) },
        };

        logger.info(`[${endpoint}] Sales summary generated successfully`, { userId });
        res.status(200).json(summary);

    } catch (error) {
        logger.error(`[${endpoint}] Error fetching sales summary`, { userId, error: error.message, stack: error.stack });
        res.status(500).json({ message: 'Failed to fetch sales summary', error: error.message });
    }
}

async function getSalesOverTime(req, res) {
    const endpoint = '/api/stats/sales-over-time (GET)';
    const userId = req.userId;
    if (!userId) return res.status(401).json({ message: 'User not identified' });

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        logger.warn(`[${endpoint}] Validation failed`, { userId, errors: errors.array() });
        return res.status(400).json({ message: "Validation failed", errors: errors.array() });
    }

    const groupBy = req.query.groupBy || 'day'; // 'day', 'week', 'month'
    const days = parseInt(req.query.days) || 30; // Default to last 30 days
    logger.info(`[${endpoint}] Fetching sales over time`, { userId, groupBy, days });

    try {
        const endDate = new Date();
        const startDate = new Date();
        startDate.setDate(endDate.getDate() - days);
        startDate.setHours(0, 0, 0, 0);

        let groupFormat;
        let dateTruncUnit; // For MongoDB versions >= 5.0
        switch (groupBy) {
            case 'month': groupFormat = "%Y-%m"; dateTruncUnit = "month"; break;
            case 'week': groupFormat = "%Y-%U"; dateTruncUnit = "week"; break; // ISO week: "%Y-%V"
            case 'day':
            default: groupFormat = "%Y-%m-%d"; dateTruncUnit = "day"; break;
        }

        const pipeline = [
            {
                $match: {
                    userId: new mongoose.Types.ObjectId(userId),
                    type: 'received',
                    status: 'confirmed',
                    timestamp: { $gte: startDate, $lte: endDate }
                }
            },
            {
                $group: {
                    // Use $dateTrunc if available (MongoDB >= 5.0) for better performance/accuracy
                    // _id: { $dateTrunc: { date: "$timestamp", unit: dateTruncUnit, timezone: "UTC" } }, // Example
                    _id: { $dateToString: { format: groupFormat, date: "$timestamp", timezone: "UTC" } }, // Fallback for older MongoDB
                    totalBRL: { $sum: '$convertedBRL' },
                    totalBCH: { $sum: '$amount' }, // Assuming 'amount' field stores BCH
                    count: { $sum: 1 }
                }
            },
            {
                $sort: { _id: 1 } // Sort by the period (e.g., "2023-10-26", "2023-10-27")
            },
            {
                $project: {
                    _id: 0, // Exclude default _id
                    period: '$_id',
                    totalBRL: 1,
                    totalBCH: 1,
                    count: 1,
                }
            }
        ];

        const results = await Transaction.aggregate(pipeline);
        logger.info(`[${endpoint}] Sales over time data generated`, { userId, count: results.length });
        res.status(200).json(results);

    } catch (error) {
        logger.error(`[${endpoint}] Error fetching sales over time`, { userId, error: error.message, stack: error.stack });
        res.status(500).json({ message: 'Failed to fetch sales over time data', error: error.message });
    }
}

module.exports = {
    getSalesSummary,
    getSalesOverTime,
};