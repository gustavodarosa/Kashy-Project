// backend/src/services/generativeAIService.js
const { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } = require("@google/generative-ai");

// Pega a API Key do ambiente. Garanta que .env foi carregado antes (em server.js)
const apiKey = process.env.API_KEY;
if (!apiKey) {
  throw new Error("API_KEY do Google não encontrada. Verifique o arquivo .env");
}

const genAI = new GoogleGenerativeAI(apiKey);

const model = genAI.getGenerativeModel({
    model: "gemini-1.5-flash",
    // Opcional: Ajustes de segurança - configure conforme necessário
    // safetySettings: [
    //   { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
    //   { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
    // ],
});

/**
 * Gera insights usando a API do Google Generative AI.
 * @param {string} promptText - O prompt para a IA.
 * @returns {Promise<string>} - A resposta gerada pela IA.
 */
async function generateInsights(promptText) {
  try {
    console.log(`[AI Service] Gerando conteúdo para o prompt: "${promptText.substring(0, 50)}..."`);

    const result = await model.generateContent(promptText);
    const response = await result.response; // Precisa esperar a Promise da resposta
    const text = await response.text();    // Precisa esperar a Promise do texto

    console.log("[AI Service] Conteúdo gerado com sucesso.");
    return text;

  } catch (error) {
    console.error("[AI Service] Erro ao gerar insights com a IA:", error);
    // Você pode querer tratar tipos específicos de erro da API aqui
    // Ex: if (error.message.includes("SAFETY")) { ... }
    throw new Error("Falha ao comunicar com o serviço de IA."); // Lança um erro para o controller tratar
  }
}

module.exports = { generateInsights };