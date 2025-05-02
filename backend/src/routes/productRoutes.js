const express = require('express');
const router = express.Router();
const productController = require('../controllers/productController');
const Product = require('../models/product'); // Certifique-se de que o modelo de produto está configurado

router.post('/', productController.createProduct);
router.get('/', productController.getProducts);
router.put('/:id', productController.updateProduct);
router.delete('/:id', productController.deleteProduct);

router.get('/low-stock', async (req, res) => {
  try {
    const lowStockProducts = await Product.find({ quantity: { $lt: 5 } });
    res.status(200).json(lowStockProducts);
  } catch (error) {
    console.error('Erro ao buscar produtos com estoque baixo:', error);
    res.status(500).json({ message: 'Erro ao buscar produtos com estoque baixo.' });
  }
});

router.get('/products', async (req, res) => {
  const { store } = req.query;
  const filter = store && store !== 'all' ? { store } : {};
  const products = await Product.find(filter);
  res.json(products);
});

router.get('/marketplace', productController.getMarketplaceProducts);

module.exports = router;