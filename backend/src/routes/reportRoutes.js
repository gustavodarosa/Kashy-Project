const express = require("express");
const { generateAIReport } = require("../controllers/reportController");

const router = express.Router();

router.post("/generate-ai-report", generateAIReport);

module.exports = router;