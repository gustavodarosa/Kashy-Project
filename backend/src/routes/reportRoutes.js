const express = require('express');
const { generateAIReport, saveReport, getReports, updateReport, deleteReport } = require('../controllers/reportController');

const router = express.Router();

// Rota para buscar todos os relatórios
router.get('/', getReports);

// Rota para criar um relatório
router.post('/save-report', saveReport);

// Rota para atualizar um relatório
router.put('/:id', updateReport);

// Rota para deletar um relatório
router.delete('/:id', deleteReport);

// Rota para gerar relatório com IA
router.post('/generate-ai-report', generateAIReport);

module.exports = router;