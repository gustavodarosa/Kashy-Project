app.post("/api/reports/generate-ai-report", async (req, res) => {
  const { prompt } = req.body;

  console.log("Prompt recebido no backend:", prompt);

  if (!prompt) {
    console.error("Erro: Prompt não fornecido.");
    return res.status(400).json({ message: "O campo 'prompt' é obrigatório." });
  }

  try {
    // Simulação de chamada para a API da IA
    const aiResponse = await callAIService(prompt);
    console.log("Resposta da IA:", aiResponse);

    res.status(200).json({ insights: aiResponse });
  } catch (error) {
    console.error("Erro ao processar a solicitação:", error.message);
    res.status(500).json({ message: "Erro interno no servidor ao processar a solicitação." });
  }
});