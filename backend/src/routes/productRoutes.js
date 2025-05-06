const express = require('express');
const router = express.Router();
const productController = require('../controllers/productController');
const Product = require('../models/product'); // Certifique-se de que o modelo de produto está configurado
// --- MODIFICATION: Import validation ---
const { validate } = require('../middlewares/validators');
const {
  createProductSchema,
  updateProductSchema,
  productIdParamSchema
} = require('../middlewares/validators/productValidators');
const { protect: authMiddleware } = require('../middlewares/authMiddleware'); // Import the protect function
// --- END MODIFICATION ---

// POST /api/products - Create Product
router.post('/', authMiddleware, validate(createProductSchema), productController.createProduct); // Added authMiddleware
// GET /api/products - Get All Products (or filtered by store query param)
router.get('/', productController.getProducts);
// PUT /api/products/:id - Update Product
router.put('/:id', authMiddleware, validate(productIdParamSchema, 'params'), validate(updateProductSchema), productController.updateProduct); // Added authMiddleware
// DELETE /api/products/:id - Delete Product
router.delete('/:id', authMiddleware, validate(productIdParamSchema, 'params'), productController.deleteProduct); // Added authMiddleware

router.get('/low-stock', async (req, res) => {
  try {
    const lowStockProducts = await Product.find({ quantity: { $lt: 5 } });
    res.status(200).json(lowStockProducts);
  } catch (error) {
    console.error('Erro ao buscar produtos com estoque baixo:', error);
    res.status(500).json({ message: 'Erro ao buscar produtos com estoque baixo.' });
  }
});

// GET /api/products/marketplace - Get active products for marketplace
router.get('/marketplace', productController.getMarketplaceProducts);

module.exports = router;