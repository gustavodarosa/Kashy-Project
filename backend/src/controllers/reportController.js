// backend/src/controllers/reportController.js
const { generateInsights } = require("../services/generativeAIService"); // Importa a função do serviço

/**
 * Lida com a requisição para gerar um relatório de IA.
 */
async function generateAIReport(req, res) {
  // 1. Extrai o prompt do corpo da requisição
  const { prompt } = req.body;
  console.log("[Controller] Recebido pedido para gerar relatório com prompt:", prompt ? `"${prompt.substring(0, 50)}..."` : "(vazio)");

  // 2. Valida o prompt
  if (!prompt || typeof prompt !== 'string' || prompt.trim() === '') {
    console.log("[Controller] Erro: Prompt inválido ou ausente.");
    return res.status(400).json({ message: "O campo 'prompt' é obrigatório e não pode ser vazio." });
  }

  try {
    // 3. Chama o serviço para gerar os insights
    console.log("[Controller] Chamando o serviço de IA...");
    const insights = await generateInsights(prompt);
    console.log("[Controller] Insights recebidos do serviço.");

    // 4. Envia a resposta de sucesso para o cliente
    //    O frontend espera um objeto { insights: "..." }
    res.status(200).json({ insights: insights });

  } catch (error) {
    // 5. Lida com erros vindos do serviço ou outros problemas
    console.error("[Controller] Erro ao processar a geração do relatório:", error.message);
    // Envia uma mensagem de erro genérica para o cliente
    res.status(500).json({ message: "Erro interno no servidor ao gerar o relatório com IA." });
  }
}

module.exports = { generateAIReport };