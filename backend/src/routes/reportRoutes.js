const express = require('express');
const { generateAIReport, saveReport, getReports, updateReport, deleteReport } = require('../controllers/reportController');
// --- MODIFICATION: Import validation ---
const { validate } = require('../middlewares/validators');
const {
  generateAIReportSchema,
  saveReportSchema,
  updateReportSchema,
  reportIdParamSchema
} = require('../middlewares/validators/reportValidators'); // Assuming these schemas exist
const { protect: authMiddleware } = require('../middlewares/authMiddleware'); // Import the protect function
// --- END MODIFICATION ---

const router = express.Router();

// --- MODIFICATION: Apply auth middleware to all report routes ---
router.use(authMiddleware); // Now correctly refers to the protect function

// Rota para buscar todos os relatórios
router.get('/', getReports); // No input validation needed for basic GET all

// Rota para criar um relatório
// --- MODIFICATION: Changed path to be more RESTful and added validation ---
router.post(
    '/',
    validate(saveReportSchema),
    saveReport
);

// Rota para atualizar um relatório
// --- MODIFICATION: Added validation ---
router.put('/:id', validate(reportIdParamSchema, 'params'), validate(updateReportSchema), updateReport);

// Rota para deletar um relatório
// --- MODIFICATION: Added validation ---
router.delete('/:id', validate(reportIdParamSchema, 'params'), deleteReport);

// Rota para gerar relatório com IA
// --- MODIFICATION: Added validation ---
router.post('/generate-ai-report', validate(generateAIReportSchema), generateAIReport);

module.exports = router;