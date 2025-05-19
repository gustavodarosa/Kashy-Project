// backend/src/controllers/reportController.js
const { generateInsights } = require("../services/generativeAIService"); // Importa a função do serviço
const Report = require('../models/report'); // Importa o modelo de relatório

/**
 * Lida com a requisição para gerar um relatório de IA.
 */
async function generateAIReport(req, res) {
  const { prompt, history } = req.body;
  if (!prompt || typeof prompt !== 'string' || prompt.trim() === '') {
    return res.status(400).json({ message: "O campo 'prompt' é obrigatório e não pode ser vazio." });
  }

  try {
    let contexto = '';
    // Exemplo: adapte os nomes dos models conforme seu projeto
    if (prompt.toLowerCase().includes('usuário')) {
      const User = require('../models/user');
      const totalUsuarios = await User.countDocuments();
      contexto = `Atualmente existem ${totalUsuarios} usuários cadastrados no sistema.`;
    } else if (prompt.toLowerCase().includes('estoque baixo')) {
      const Product = require('../models/product');
      const lowStock = await Product.find({ quantity: { $lt: 5 } });
      contexto = `Produtos com estoque baixo (${lowStock.length}):\n` +
        lowStock.map(p => `- ${p.name}: ${p.quantity} unidades`).join('\n');
    } else if (prompt.toLowerCase().includes('produtos existem')) {
      const Product = require('../models/product');
      const totalProdutos = await Product.countDocuments();
      contexto = `Existem atualmente ${totalProdutos} produtos cadastrados no estoque.`;
    } else if (prompt.toLowerCase().includes('alerta de estoque')) {
      const Product = require('../models/product');
      // Considera alerta de estoque como produtos com quantidade <= mínimo (ou < 5 se não houver campo mínimo)
      const produtosAlerta = await Product.find({ $or: [{ quantity: { $lte: 5 } }, { minimum: { $exists: true, $gt: 0 }, $expr: { $lte: ["$quantity", "$minimum"] } }] });
      contexto = `Produtos em alerta de estoque (${produtosAlerta.length}):\n` +
        produtosAlerta.map(p => `- ${p.name}: ${p.quantity} unidades (mínimo: ${p.minimum ?? 5})`).join('\n');
    } else if (prompt.toLowerCase().includes('número de pedidos') || prompt.toLowerCase().includes('numero de pedidos')) {
      const Order = require('../models/order');
      const totalPedidos = await Order.countDocuments();
      contexto = `O sistema possui atualmente ${totalPedidos} pedidos registrados.`;
    } else if (prompt.toLowerCase().includes('número de transações') || prompt.toLowerCase().includes('numero de transações')) {
      const Transaction = require('../models/transaction');
      const totalTransacoes = await Transaction.countDocuments();
      contexto = `O sistema possui atualmente ${totalTransacoes} transações registradas.`;
    } else {
      contexto = 'Dados não encontrados para este tipo de relatório.';
    }

    // Monte o histórico em formato de texto
    let historyText = '';
    if (Array.isArray(history)) {
      historyText = history.map(msg => `${msg.role === "user" ? "Usuário" : "IA"}: ${msg.message}`).join('\n');
    }

    const fullPrompt = `${historyText}\n${contexto}\nUsuário: ${prompt}`;
    const insights = await generateInsights(fullPrompt);
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