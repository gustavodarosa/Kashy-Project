// backend/src/controllers/reportController.js
const { generateInsights } = require("../services/generativeAIService"); // Importa a função do serviço
const Report = require('../models/report'); // Importa o modelo de relatório
const logger = require('../utils/logger'); // Adicionar logger
// --- MODIFICATION: Import validationResult ---
const { validationResult } = require('express-validator');
// --- END MODIFICATION ---

/**
 * Lida com a requisição para gerar um relatório de IA.
 */
async function generateAIReport(req, res) {
  const endpoint = '/api/reports/generate-ai-report (POST)';
  const userId = req.userId; // Obter userId do authMiddleware
  if (!userId) {
      logger.error(`[${endpoint}] Error: userId not found in request.`);
      return res.status(401).json({ message: 'User not identified' });
  }
  // --- MODIFICATION: Add validation check ---
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
      logger.warn(`[${endpoint}] Generate AI report validation failed for user ${userId}: ${JSON.stringify(errors.array())}`);
      return res.status(400).json({ message: "Validation failed", errors: errors.array() });
  }
  // --- END MODIFICATION ---
  const { prompt } = req.body;
  // Basic check removed as it should be covered by the schema validation
  // if (!prompt || typeof prompt !== 'string' || prompt.trim() === '') { ... }

  try {
    const insights = await generateInsights(prompt);
    logger.info(`[${endpoint}] User ${userId} generated AI report.`);
    res.status(200).json({ insights });
  } catch (error) {
    console.error("[Controller] Erro ao processar a geração do relatório:", error.message);
    res.status(500).json({ message: "Erro interno no servidor ao gerar o relatório com IA." });
  }
}

/**
 * Lida com a requisição para salvar um relatório.
 */
async function saveReport(req, res) {
  const endpoint = '/api/reports (POST)'; // Updated endpoint path
  const userId = req.userId; // Obter userId do authMiddleware
  if (!userId) {
      logger.error(`[${endpoint}] Error: userId not found in request.`);
      return res.status(401).json({ message: 'User not identified' });
  }
  logger.info(`[${endpoint}] User ${userId} saving report.`);
  // --- MODIFICATION: Add validation check ---
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
      logger.warn(`[${endpoint}] Save report validation failed for user ${userId}: ${JSON.stringify(errors.array())}`);
      return res.status(400).json({ message: "Validation failed", errors: errors.array() });
  }
  // --- END MODIFICATION ---

  try {
    const { title, type, dateRange, generatedAt, previewData, isAIGenerated, promptUsed } = req.body;

    console.log('Dados recebidos para salvar relatório:', {
      title,
      type,
      dateRange,
      generatedAt,
      previewData,
      isAIGenerated,
      promptUsed,
    });

    const newReport = new Report({
      userId: userId, // Associar o relatório ao usuário
      title,
      type,
      dateRange,
      generatedAt,
      data: previewData,
      isAIGenerated,
      promptUsed,
    });

    const savedReport = await newReport.save();
    logger.info(`[${endpoint}] Report ${savedReport._id} saved successfully by user ${userId}.`);
    res.status(201).json(savedReport);
  } catch (error) {
    console.error('Erro ao salvar relatório:', error);
    res.status(500).json({ message: 'Erro ao salvar relatório.' });
  }
}

/**
 * Lida com a requisição para buscar todos os relatórios.
 */
async function getReports(req, res) {
  const endpoint = '/api/reports (GET)';
  const userId = req.userId; // Obter userId do authMiddleware
  if (!userId) {
      logger.error(`[${endpoint}] Error: userId not found in request.`);
      return res.status(401).json({ message: 'User not identified' });
  }
  logger.info(`[${endpoint}] User ${userId} fetching reports.`);
  try {
    const reports = await Report.find({ userId: userId }); // Filtrar relatórios pelo usuário logado
    res.status(200).json(reports);
  } catch (error) {
    console.error('Erro ao buscar relatórios:', error);
    res.status(500).json({ message: 'Erro ao buscar relatórios.' });
  }
}

/**
 * Atualiza um relatório existente.
 */
async function updateReport(req, res) {
  const endpoint = '/api/reports/:id (PUT)';
  const userId = req.userId; // Obter userId do authMiddleware
  // --- MODIFICATION: Add validation check ---
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
      logger.warn(`[${endpoint}] Update report validation failed for user ${userId}: ${JSON.stringify(errors.array())}`);
      return res.status(400).json({ message: "Validation failed", errors: errors.array() });
  }
  // --- END MODIFICATION ---
  const id = req.params.id || req.body.id || req.body._id; // Aceita `id` ou `_id`
  if (!userId) {
      logger.error(`[${endpoint}] Error: userId not found in request.`);
      return res.status(401).json({ message: 'User not identified' });
  }
  if (!id) { // This check might be redundant if param validation is robust
    return res.status(400).json({ message: 'ID do relatório não fornecido.' });
  }
  logger.info(`[${endpoint}] User ${userId} updating report ${id}.`);

  try {
    const updatedData = req.body;
    // Verificar se o relatório pertence ao usuário antes de atualizar
    const updatedReport = await Report.findOneAndUpdate({ _id: id, userId: userId }, updatedData, { new: true });

    if (!updatedReport) {
      return res.status(404).json({ message: 'Relatório não encontrado.' });
    }

    res.status(200).json(updatedReport);
  } catch (error) {
    console.error('Erro ao atualizar relatório:', error);
    res.status(500).json({ message: 'Erro ao atualizar relatório.' });
  }
}

/**
 * Deleta um relatório existente.
 */
async function deleteReport(req, res) {
  const endpoint = '/api/reports/:id (DELETE)';
  const userId = req.userId; // Obter userId do authMiddleware
  // --- MODIFICATION: Add validation check ---
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
      logger.warn(`[${endpoint}] Delete report validation failed for user ${userId}: ${JSON.stringify(errors.array())}`);
      return res.status(400).json({ message: "Validation failed", errors: errors.array() });
  }
  // --- END MODIFICATION ---
  const { id } = req.params;
  if (!userId) {
      logger.error(`[${endpoint}] Error: userId not found in request.`);
      return res.status(401).json({ message: 'User not identified' });
  }
  logger.info(`[${endpoint}] User ${userId} deleting report ${id}.`); // id is guaranteed by validation now

  try {
    const deletedReport = await Report.findOneAndDelete({ _id: id, userId: userId }); // Verificar se pertence ao usuário

    if (!deletedReport) {
      return res.status(404).json({ message: 'Relatório não encontrado.' });
    }

    res.status(200).json({ message: 'Relatório deletado com sucesso.' });
  } catch (error) {
    console.error('Erro ao deletar relatório:', error);
    res.status(500).json({ message: 'Erro ao deletar relatório.' });
  }
}

module.exports = { generateAIReport, saveReport, getReports, updateReport, deleteReport }; // Removido deleteReportFrontend