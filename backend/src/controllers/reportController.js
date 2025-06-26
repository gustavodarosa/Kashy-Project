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
  console.log(`[Backend] Received parameters: lines=${JSON.stringify(lines)}, value=${value}, func=${func}`);

  if (lines.length === 0 || !value || !func) {
    res.status(400);
    throw new Error('Parâmetros de relatório incompletos: line, value e func são obrigatórios.');
  }

  // Mapeamento de campos válidos para agregação
  const validLines = ['store', 'paymentMethod', 'status', 'items.name', 'createdAt.month']; // Adicionado 'createdAt.month'
  const validValues = ['totalAmount', 'items.quantity', 'items.revenue', 'netAmount']; // Adicionado 'netAmount'
  const validFunctions = ['sum', 'avg', 'count']; // Funções de agregação (count é para documentos, não valores)

  for (const l of lines) {
    if (!validLines.includes(l)) {
      res.status(400);
      throw new Error(`Linha de agrupamento inválida: ${l}. Opções válidas: ${validLines.join(', ')}`);
    }
  }
  if (!validValues.includes(value)) {
    res.status(400);
    throw new Error(`Valor para agregação inválido: ${value}. Opções válidas: ${validValues.join(', ')}`);
  }
  if (!validFunctions.includes(func)) {
    res.status(400);
    throw new Error(`Função de agregação inválida: ${func}. Opções válidas: ${validFunctions.join(', ')}`);
  }
  // Validação contextual para combinações
  console.log(`[Backend] Checking validation: lines.includes('items.name')=${lines.includes('items.name')}, value === 'totalAmount'=${value === 'totalAmount'}`);
  if (lines.includes('items.name') && value === 'totalAmount') {
    res.status(400);
    throw new Error('Não é possível agregar "Valor Total do Pedido" quando agrupado por produto ou usando a quantidade de itens.');
  }
  console.log(`[Backend] Checking validation: value === 'items.quantity'=${value === 'items.quantity'}, func === 'avg'=${func === 'avg'}`);
  if (value === 'items.quantity' && func === 'avg') {
    res.status(400);
    throw new Error('A função "Média" não é suportada para "Quantidade de Itens" no momento.');
  }

  try {
    let aggregationPipeline = [];

    // 1. Filtrar pedidos condicionalmente com base no papel (role) do usuário
    const userRole = req.user.role; // Assumindo que o role está em req.user

    if (userRole === 'user') {
      logger.debug(`[ReportController] Filtrando relatório para o usuário padrão: ${userId}`);
      aggregationPipeline.push({ $match: { user: userId } });
    } else if (userRole === 'merchant' || userRole === 'admin') { // Permitir que merchants/admins vejam todos os dados
      logger.info(`[ReportController] Gerando relatório global para o usuário merchant/admin: ${userId}.`);
      // Não adiciona o filtro de usuário, buscando todos os pedidos.
    }

    // Se a análise for por produto ou quantidade, precisamos "desdobrar" os itens do pedido
    if (lines.some(l => l.startsWith('items.')) || value.startsWith('items.')) {
      aggregationPipeline.push({ $unwind: '$items' });
    }
    
    // Adicionar estágio para calcular 'netAmount' se for o valor selecionado
    if (value === 'netAmount') {
      aggregationPipeline.push({
        $addFields: { netAmount: { $subtract: ['$totalAmount', { $add: ['$discount', '$tax', '$shippingCost'] }] } } // Exemplo de cálculo
      });
    }

    // 2. Definir a função de agregação
    let aggregationOperator;
    let valueField;
    let preGroupStage = null; // Novo estágio para cálculos antes do agrupamento

    if (value === 'items.quantity') {
      valueField = '$items.quantity';
    } else if (value === 'items.revenue') {
      // Para faturamento por produto, calculamos (quantidade * preço)
      // Assumimos que items.priceBRL existe no subdocumento items
      // Se não existir, você precisaria de um $lookup aqui para buscar o preço do produto
      // ou garantir que o preço seja salvo no item do pedido.
      valueField = '$items.calculatedRevenue'; // O campo que será criado
      preGroupStage = {
        $addFields: { 'items.calculatedRevenue': { $multiply: ['$items.quantity', '$items.priceBRL'] } }
      };
    }
    else { // Para 'totalAmount' ou outros campos diretos
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
        aggregationOperator = { $sum: 1 }; // Count documents
        break;
      default:
        res.status(400);
        throw new Error('Função de agregação não suportada.');
    }

    // Adicionar o estágio de pré-agrupamento se existir
    if (preGroupStage) {
      aggregationPipeline.push(preGroupStage);
    }

    // Construir o _id para o estágio $group, permitindo múltiplos campos
    let groupById = {};
    lines.forEach(l => {
      // Para campos de data, use $dateToString para extrair a parte desejada
      if (l === 'createdAt.month') {
        groupById[l.replace('.', '_')] = { $dateToString: { format: "%Y-%m", date: "$createdAt" } };
      } else {
        groupById[l.replace('.', '_')] = `$${l}`;
      }
      // Substitui '.' por '_' no nome da chave para evitar problemas com MongoDB
      groupById[l.replace('.', '_')] = `$${l}`;
    });

    // 3. Agrupar pelos campos selecionados
    aggregationPipeline.push({
      $group: {
        _id: groupById, // Agrupa pelos campos 'lines'
        result: aggregationOperator, // O resultado da agregação
      },
    });

    // 4. Ordenar os resultados (do maior para o menor)
    aggregationPipeline.push({ $sort: { result: -1 } });

    console.log(`[ReportController] DEBUG: Aggregation Pipeline (before execution): ${JSON.stringify(aggregationPipeline, null, 2)}`); // Adicionado console.log para garantir visibilidade
    logger.debug(`[ReportController] Aggregation Pipeline (before execution): ${JSON.stringify(aggregationPipeline, null, 2)}`); // Mantido logger.debug
    const reportData = await Order.aggregate(aggregationPipeline);

    console.log(`[ReportController] DEBUG: Raw Report Data from DB (before response): ${JSON.stringify(reportData, null, 2)}`); // Adicionado console.log para garantir visibilidade
    logger.debug(`[ReportController] Raw Report Data from DB (before response): ${JSON.stringify(reportData, null, 2)}`); // Mantido logger.debug
    res.status(200).json(reportData);
  } catch (error) {
    logger.error(`[ReportController] Erro ao gerar relatório: ${error.message}`, error.stack);
    res.status(500).json({ message: 'Erro interno ao gerar relatório.' });
  }
});

module.exports = {
  generateReport,
};
