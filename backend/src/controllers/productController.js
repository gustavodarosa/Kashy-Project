const Product = require('../models/product');
const logger = require('../utils/logger'); // Adicionar logger
// --- MODIFICATION: Import validationResult ---
const { validationResult } = require('express-validator');
// --- END MODIFICATION ---

const createProduct = async (req, res) => {
  const endpoint = '/api/products (POST)';
  // --- MODIFICATION: Add validation check ---
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
      logger.warn(`[${endpoint}] Product creation validation failed: ${JSON.stringify(errors.array())}`);
      return res.status(400).json({ message: "Validation failed", errors: errors.array() });
  }
  // --- END MODIFICATION ---
  const userId = req.userId; // Obter userId do authMiddleware
  if (!userId) {
      logger.error(`[${endpoint}] Error: userId not found in request.`);
      return res.status(401).json({ message: 'User not identified' });
  }
  logger.info(`[${endpoint}] User ${userId} creating product.`);

  try {
    // Associar o produto ao usuário (ou à loja do usuário, dependendo da lógica)
    const product = new Product({ ...req.body, createdBy: userId }); // Exemplo: adicionando createdBy
    await product.save();
    logger.info(`[${endpoint}] Product ${product._id} created successfully by user ${userId}.`);
    res.status(201).json(product);
  } catch (error) {
    console.error('Error creating product:', error);
    res.status(400).json({ message: error.message });
  }
};

const getProducts = async (req, res) => {
  const endpoint = '/api/products (GET)';
  const userId = req.userId; // Obter userId do authMiddleware (se necessário para filtrar)
  // Se a intenção é buscar produtos *do usuário logado* ou da *loja dele*:
  // if (!userId) {
  //     logger.error(`[${endpoint}] Error: userId not found in request.`);
  //     return res.status(401).json({ message: 'User not identified' });
  // }
  // logger.info(`[${endpoint}] User ${userId} fetching products.`);
  // const filter = { createdBy: userId }; // Exemplo de filtro

  try {
    const { store } = req.query; // Recebe o parâmetro 'store' da query string
    const filter = store ? { store } : {}; // Aplica o filtro apenas se 'store' for fornecido
    const products = await Product.find(filter); // Busca produtos no MongoDB com o filtro
    res.status(200).json(products);
  } catch (error) {
    console.error('Erro ao buscar produtos:', error);
    res.status(500).json({ message: 'Erro ao buscar produtos', error: error.message });
  }
};

const getMarketplaceProducts = async (req, res) => {
  try {
    const products = await Product.find({ isActive: true }); // Apenas produtos ativos
    res.status(200).json(products);
  } catch (error) {
    console.error('Erro ao buscar produtos do marketplace:', error);
    res.status(500).json({ message: 'Erro ao buscar produtos do marketplace', error: error.message });
  }
};

const updateProduct = async (req, res) => {
  const endpoint = '/api/products/:id (PUT)';
  const userId = req.userId; // Obter userId do authMiddleware
  // --- MODIFICATION: Add validation check ---
  // This checks both param and body validation defined in the route
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
      logger.warn(`[${endpoint}] Product update validation failed: ${JSON.stringify(errors.array())}`);
      return res.status(400).json({ message: "Validation failed", errors: errors.array() });
  }
  // --- END MODIFICATION ---
  const { id } = req.params;
  if (!userId) {
      logger.error(`[${endpoint}] Error: userId not found in request.`);
      return res.status(401).json({ message: 'User not identified' });
  }
  logger.info(`[${endpoint}] User ${userId} updating product ${id}.`);

  try {
    // Verificar se o produto pertence ao usuário antes de atualizar
    const product = await Product.findOneAndUpdate(
        { _id: id /* , createdBy: userId */ }, // Adicionar filtro por usuário se necessário
        req.body,
        { new: true }
    );
    if (!product) return res.status(404).json({ message: 'Produto não encontrado' });
    logger.info(`[${endpoint}] Product ${id} updated successfully by user ${userId}.`);
    res.status(200).json(product);
  } catch (error) {
    res.status(400).json({ message: 'Erro ao atualizar produto', error: error.message });
  }
};

const deleteProduct = async (req, res) => {
  const endpoint = '/api/products/:id (DELETE)';
  const userId = req.userId; // Obter userId do authMiddleware
  // --- MODIFICATION: Add validation check ---
  // This checks param validation defined in the route
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
      logger.warn(`[${endpoint}] Product delete validation failed: ${JSON.stringify(errors.array())}`);
      return res.status(400).json({ message: "Validation failed", errors: errors.array() });
  }
  // --- END MODIFICATION ---
  const { id } = req.params;
  if (!userId) {
      logger.error(`[${endpoint}] Error: userId not found in request.`);
      return res.status(401).json({ message: 'User not identified' });
  }
  logger.info(`[${endpoint}] User ${userId} deleting product ${id}.`);

  try {
    // Verificar se o produto pertence ao usuário antes de deletar
    const product = await Product.findOneAndDelete({ _id: id /* , createdBy: userId */ }); // Adicionar filtro por usuário se necessário
    if (!product) {
      logger.warn(`[${endpoint}] Product ${id} not found or user ${userId} not authorized.`);
      return res.status(404).json({ message: 'Produto não encontrado' });
    }
    res.status(200).json({ message: 'Produto excluído com sucesso' });
  } catch (error) {
    console.error('Erro ao excluir produto:', error);
    res.status(500).json({ message: 'Erro ao excluir produto', error: error.message });
  }
};

module.exports = {
  createProduct,
  getProducts,
  getMarketplaceProducts,
  updateProduct,
  deleteProduct,
};