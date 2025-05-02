// backend/src/routes/reportRoutes.js
const express = require("express");
const { generateAIReport } = require("../controllers/reportController"); // Importa o controlador

const router = express.Router();

// Define a rota POST que usará a função generateAIReport do controlador
// O caminho completo será /api/reports/generate-ai-report (prefixo definido em server.js)
router.post("/generate-ai-report", generateAIReport);

module.exports = router; // Exporta o router configurado