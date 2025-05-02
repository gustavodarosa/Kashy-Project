// backend/src/controllers/reportController.js
const { generateInsights } = require("../services/generativeAIService"); // Importa a função do serviço
const Report = require('../models/report'); // Importa o modelo de relatório

/**
 * Lida com a requisição para gerar um relatório de IA.
 */
async function generateAIReport(req, res) {
  const { prompt } = req.body;
  if (!prompt || typeof prompt !== 'string' || prompt.trim() === '') {
    return res.status(400).json({ message: "O campo 'prompt' é obrigatório e não pode ser vazio." });
  }

  try {
    const insights = await generateInsights(prompt);
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
  try {
    const { title, type, dateRange, generatedAt, previewData, isAIGenerated, promptUsed } = req.body;

    // Log the incoming data for debugging
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
      title,
      type,
      dateRange,
      generatedAt,
      data: previewData,
      isAIGenerated,
      promptUsed,
    });

    const savedReport = await newReport.save();
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
  try {
    const reports = await Report.find(); // Busca todos os relatórios no MongoDB
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
  try {
    const id = req.params.id || req.body.id || req.body._id; // Aceita `id` ou `_id`
    if (!id) {
      return res.status(400).json({ message: 'ID do relatório não fornecido.' });
    }

    const updatedData = req.body;
    const updatedReport = await Report.findByIdAndUpdate(id, updatedData, { new: true });

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
  try {
    const { id } = req.params;

    const deletedReport = await Report.findByIdAndDelete(id);

    if (!deletedReport) {
      return res.status(404).json({ message: 'Relatório não encontrado.' });
    }

    res.status(200).json({ message: 'Relatório deletado com sucesso.' });
  } catch (error) {
    console.error('Erro ao deletar relatório:', error);
    res.status(500).json({ message: 'Erro ao deletar relatório.' });
  }
}

const deleteReportFrontend = async (id) => {
  console.log('Tentando deletar relatório com ID:', id); // Log para depuração
  if (!window.confirm(`Tem certeza que deseja excluir o relatório ID: ${id}?`)) return;

  try {
    const response = await fetch(`http://localhost:3000/api/reports/${id}`, {
      method: 'DELETE',
    });

    if (!response.ok) {
      throw new Error('Erro ao deletar relatório.');
    }

    // Atualize o estado local removendo o relatório excluído
    setReports((prev) => prev.filter((r) => r._id !== id)); // Use `_id` aqui
  } catch (error) {
    console.error('Erro ao deletar relatório:', error);
    setError('Erro ao deletar relatório.');
  }
};

module.exports = { generateAIReport, saveReport, getReports, updateReport, deleteReport, deleteReportFrontend };