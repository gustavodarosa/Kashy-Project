const Product = require('../models/product');

const createProduct = async (req, res) => {
  try {
    console.log('Received payload:', req.body); // Log the payload
    const product = new Product(req.body);
    await product.save();
    res.status(201).json(product);
  } catch (error) {
    console.error('Error creating product:', error);
    res.status(400).json({ message: error.message });
  }
};

const getProducts = async (req, res) => {
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
  try {
    const { id } = req.params;
    const product = await Product.findByIdAndUpdate(id, req.body, { new: true });
    if (!product) return res.status(404).json({ message: 'Produto não encontrado' });
    res.status(200).json(product);
  } catch (error) {
    res.status(400).json({ message: 'Erro ao atualizar produto', error: error.message });
  }
};

const deleteProduct = async (req, res) => {
  try {
    const { id } = req.params;
    const product = await Product.findByIdAndDelete(id);
    if (!product) {
      return res.status(404).json({ message: 'Produto não encontrado' });
    }
    res.status(200).json({ message: 'Produto excluído com sucesso' });
  } catch (error) {
    console.error('Erro ao excluir produto:', error);
    res.status(500).json({ message: 'Erro ao excluir produto', error: error.message });
  }
};

const getProductByBarcode = async (req, res) => {
  try {
    const { barcode } = req.params;
    console.log('Searching for product with barcode:', barcode); 
    const product = await Product.findOne({ barcode });
    if (!product) {
      console.log('Product not found for barcode:', barcode); 
      return res.status(404).json({ message: 'Produto não encontrado.' });
    }
    res.json(product);
  } catch (error) {
    console.error('Erro ao buscar produto por código de barras:', error);
    res.status(500).json({ message: 'Erro interno do servidor.' });
  }
};

module.exports = {
  createProduct,
  getProducts,
  getMarketplaceProducts,
  updateProduct,
  deleteProduct,
  getProductByBarcode,
};