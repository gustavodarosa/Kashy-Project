const asyncHandler = require('express-async-handler');
const Order = require('../models/Order'); // Importe o modelo de Pedido
const logger = require('../utils/logger');

/**
 * @desc    Generate dynamic reports based on aggregation parameters
 * @route   GET /api/reports
 * @access  Private
 */
const generateReport = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  let { line, value, func } = req.query; // 'line' = campo(s) para agrupar, 'value' = campo para agregar, 'func' = função de agregação

  const lines = Array.isArray(line) ? line : line.split(',').map(s => s.trim()).filter(s => s); // Permite múltiplos campos separados por vírgula

  logger.info(`[ReportController] Gerando relatório para o usuário ${userId}: Linha=${line}, Valor=${value}, Função=${func}`);

  if (lines.length === 0 || !value || !func) {
    res.status(400);
    throw new Error('Parâmetros de relatório incompletos: line, value e func são obrigatórios.');
  }

  // Mapeamento de campos e funções válidos
  const VALID = {
    lines: ['store', 'paymentMethod', 'status', 'items.name', 'createdAt.month'],
    values: ['totalAmount', 'items.quantity', 'items.revenue', 'netAmount'],
    funcs: ['sum', 'avg', 'count']
  };

  for (const l of lines) {
    if (!VALID.lines.includes(l)) {
      res.status(400);
      throw new Error(`Linha de agrupamento inválida: ${l}. Opções válidas: ${VALID.lines.join(', ')}`);
    }
  }
  if (!VALID.values.includes(value)) {
    res.status(400);
    throw new Error(`Valor para agregação inválido: ${value}. Opções válidas: ${VALID.values.join(', ')}`);
  }
  if (!VALID.funcs.includes(func)) {
    res.status(400);
    throw new Error(`Função de agregação inválida: ${func}. Opções válidas: ${VALID.funcs.join(', ')}`);
  }

  // Validação contextual para combinações
  const hasItemsName = lines.includes('items.name');
  if ((hasItemsName && value === 'totalAmount') || (hasItemsName && value === 'netAmount')) {
    res.status(400);
    throw new Error(`Não é possível agregar "${value}" quando agrupado por "Produto".`);
  }
  if ((value === 'items.quantity' && func === 'avg') || (value === 'items.revenue' && func === 'count')) {
    res.status(400);
    throw new Error(`A combinação de valor "${value}" com a função "${func}" não é suportada.`);
  }

  try {
    let aggregationPipeline = [];

    // 1. Filtrar pedidos condicionalmente com base no papel (role) do usuário
    const userRole = req.user.role; 

    if (userRole === 'user') {
      logger.debug(`[ReportController] Filtrando relatório para o usuário padrão: ${userId}`);
      aggregationPipeline.push({ $match: { user: new mongoose.Types.ObjectId(userId) } });
    } else if (userRole === 'merchant' || userRole === 'admin') { 
      logger.info(`[ReportController] Gerando relatório global para o usuário merchant/admin: ${userId}.`);
    }

    // Se a análise for por produto ou quantidade, precisamos "desdobrar" os itens do pedido
    if (lines.some(l => l.startsWith('items.')) || value.startsWith('items.')) {
      aggregationPipeline.push({ $unwind: '$items' });
    }
    
    // Adicionar estágio para calcular 'netAmount' se for o valor selecionado
    if (value === 'netAmount') {
      aggregationPipeline.push({
        $addFields: { netAmount: { $subtract: ['$totalAmount', { $add: ['$discount', '$tax', '$shippingCost'] }] } }
      });
    }

    // 2. Definir a função de agregação
    let aggregationOperator;
    let valueField;
    let preGroupStage = null;

    if (value === 'items.quantity') {
      valueField = '$items.quantity';
    } else if (value === 'items.revenue') {
      valueField = '$items.calculatedRevenue'; 
      preGroupStage = {
        $addFields: { 'items.calculatedRevenue': { $multiply: ['$items.quantity', '$items.priceBRL'] } }
      };
    }
    else { 
      valueField = `$${value}`;
    }

    switch (func) {
      case 'sum':
        aggregationOperator = { $sum: valueField };
        break;
      case 'avg':
        aggregationOperator = { $avg: valueField };
        break;
      case 'count':
        aggregationOperator = { $sum: 1 };
        break;
      default:
        res.status(400);
        throw new Error('Função de agregação não suportada.');
    }

    if (preGroupStage) {
      aggregationPipeline.push(preGroupStage);
    }

    let groupById = {};
    lines.forEach(l => {
      if (l === 'createdAt.month') {
        groupById[l.replace('.', '_')] = { $dateToString: { format: "%Y-%m", date: "$createdAt" } };
      } else {
        groupById[l.replace('.', '_')] = `$${l}`;
      }
    });

    // 3. Agrupar pelos campos selecionados
    aggregationPipeline.push({
      $group: {
        _id: groupById,
        result: aggregationOperator,
      },
    });

    // 4. Limpar e formatar a saída
    const projectStage = { $project: { _id: 0, result: 1 } };
    Object.keys(groupById).forEach(key => {
      const originalKey = key.replace('_', '.');
      projectStage.$project[originalKey] = `$_id.${key}`;
    });
    aggregationPipeline.push(projectStage);


    // 5. Ordenar os resultados (do maior para o menor)
    aggregationPipeline.push({ $sort: { result: -1 } });

    logger.debug(`[ReportController] Aggregation Pipeline: ${JSON.stringify(aggregationPipeline, null, 2)}`);
    const reportData = await Order.aggregate(aggregationPipeline);

    logger.debug(`[ReportController] Raw Report Data from DB: ${JSON.stringify(reportData, null, 2)}`);
    res.status(200).json(reportData);
  } catch (error) {
    logger.error(`[ReportController] Erro ao gerar relatório: ${error.message}`, { stack: error.stack });
    res.status(500).json({ message: 'Erro interno ao gerar relatório.' });
  }
});

module.exports = {
  generateReport,
};
