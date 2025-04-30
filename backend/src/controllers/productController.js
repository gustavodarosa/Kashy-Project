const Product = require('../models/product');

const createProduct = async (req, res) => {
  try {
    const product = new Product(req.body);
    await product.save();
    res.status(201).json(product);
  } catch (error) {
    res.status(400).json({ message: 'Erro ao criar produto', error: error.message });
  }
};

const getProducts = async (req, res) => {
  try {
    const products = await Product.find();
    res.status(200).json(products);
  } catch (error) {
    res.status(500).json({ message: 'Erro ao buscar produtos', error: error.message });
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
    if (!product) return res.status(404).json({ message: 'Produto não encontrado' });
    res.status(200).json({ message: 'Produto excluído com sucesso' });
  } catch (error) {
    res.status(500).json({ message: 'Erro ao excluir produto', error: error.message });
  }
};

module.exports = {
  createProduct,
  getProducts,
  updateProduct,
  deleteProduct,
};