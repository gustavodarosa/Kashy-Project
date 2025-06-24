const asyncHandler = require('express-async-handler');
const Transaction = require('../models/transaction'); // Usando o nome do modelo corrigido

/**
 * @desc    Get transactions for the logged-in user with filtering, searching, and pagination
 * @route   GET /api/transactions
 * @access  Private
 */
const getTransactions = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  console.log(`[TransactionController] Buscando transações para o usuário: ${userId}`);

  // Parâmetros da query com valores padrão
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;
  const skip = (page - 1) * limit;

  // Objeto de consulta base
  const query = { user: userId };

  // Filtro de status
  if (req.query.status && req.query.status !== 'all') {
    query.status = req.query.status;
  }

  // Filtro de data
  if (req.query.date && req.query.date !== 'all') {
    const now = new Date();
    let startDate;
    if (req.query.date === 'today') {
      startDate = new Date(now.setHours(0, 0, 0, 0));
    } else if (req.query.date === 'week') {
      startDate = new Date(now.setDate(now.getDate() - 7));
    } else if (req.query.date === 'month') {
      startDate = new Date(now.setMonth(now.getMonth() - 1));
    }
    if (startDate) {
      query.createdAt = { $gte: startDate };
    }
  }

  // Filtro de busca por texto (case-insensitive)
  if (req.query.search) {
    const searchRegex = new RegExp(req.query.search, 'i');
    query.$or = [{ txid: searchRegex }, { address: searchRegex }];
  }

  // Executa as consultas ao banco de dados
  const totalTransactions = await Transaction.countDocuments(query);
  const transactions = await Transaction.find(query)
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit);
  console.log(`[TransactionController] Query final: ${JSON.stringify(query)}`);
  console.log(`[TransactionController] Total de transações encontradas (antes da paginação): ${totalTransactions}`);
  console.log(`[TransactionController] Transações retornadas na página ${page}: ${transactions.length}`);

  // Calcula as estatísticas com base nos filtros aplicados
  const statsPipeline = [{ $match: query }, { $group: { _id: '$status', count: { $sum: 1 } } }];
  const statsResult = await Transaction.aggregate(statsPipeline);
  const transactionStats = { confirmed: 0, pending: 0, failed: 0, expired: 0 };
  statsResult.forEach(stat => {
    if (transactionStats.hasOwnProperty(stat._id)) {
      transactionStats[stat._id] = stat.count;
    }
  });

  res.status(200).json({
    transactions,
    currentPage: page,
    totalPages: Math.ceil(totalTransactions / limit),
    totalTransactions,
    stats: transactionStats,
  });
});

module.exports = {
  getTransactions,
};