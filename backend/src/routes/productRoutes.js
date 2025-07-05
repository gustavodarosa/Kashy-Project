const express = require('express');
const router = express.Router();
const productController = require('../controllers/productController');
const Product = require('../models/product'); // Certifique-se de que o modelo de produto está configurado

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

router.post('/', productController.createProduct);
router.get('/', productController.getProducts);
router.put('/:id', productController.updateProduct);
router.delete('/:id', productController.deleteProduct);

router.get('/low-stock', async (req, res) => {
  try {
    const { store } = req.query;
    const filter = {
      $or: [
        { quantity: { $eq: 0 } },
        { quantity: { $gt: 0, $lte: 15 } }
      ]
    };
    if (store) {
      filter.store = store;
    }
    const lowStockProducts = await Product.find(filter);
    res.status(200).json(lowStockProducts);
  } catch (error) {
    console.error('Erro ao buscar produtos com estoque baixo:', error);
    res.status(500).json({ message: 'Erro ao buscar produtos com estoque baixo.' });
  }
});

router.get('/products', productController.getProducts);

router.get('/marketplace', productController.getMarketplaceProducts);

router.get('/barcode/:barcode', productController.getProductByBarcode);

module.exports = router;