const express = require('express');
const router = express.Router();

// --- Import Product Controller ---
// You'll need to create this controller if it doesn't exist
const productController = require('../controllers/productController');

// Middleware for authentication (if needed for product routes)
// The 'protect' middleware is already applied in index.js for all /products routes
// const { protect, admin } = require('../middlewares/authMiddleware');


// --- ADDED: Route for low stock products ---
// GET /api/products/low-stock
router.get('/low-stock', productController.getLowStockProducts);
// --- END ADDED ---


// GET /api/products - Get all products
// router.get('/', productController.getAllProducts); // Uncomment and implement if needed
router.get('/', (req, res) => {
    // Placeholder: Replace with controller logic
    res.status(200).json({ message: 'GET /api/products - Fetch all products (placeholder)' });
});

// GET /api/products/:id - Get a single product by ID
// router.get('/:id', productController.getProductById); // Uncomment and implement if needed
router.get('/:id', (req, res) => {
    // Placeholder: Replace with controller logic
    res.status(200).json({ message: `GET /api/products/${req.params.id} - Fetch product ${req.params.id} (placeholder)` });
});

// POST /api/products - Create a new product
// router.post('/', productController.createProduct); // Example with auth (protect/admin already applied in index.js)
router.post('/', (req, res) => {
    // Placeholder: Replace with controller logic
    res.status(201).json({ message: 'POST /api/products - Create a new product (placeholder)', data: req.body });
});

// PUT /api/products/:id - Update a product by ID
// router.put('/:id', productController.updateProduct); // Example with auth
router.put('/:id', (req, res) => {
    // Placeholder: Replace with controller logic
    res.status(200).json({ message: `PUT /api/products/${req.params.id} - Update product ${req.params.id} (placeholder)`, data: req.body });
});

// DELETE /api/products/:id - Delete a product by ID
// router.delete('/:id', productController.deleteProduct); // Example with auth
router.delete('/:id', (req, res) => {
    // Placeholder: Replace with controller logic
    res.status(200).json({ message: `DELETE /api/products/${req.params.id} - Delete product ${req.params.id} (placeholder)` });
});

module.exports = router;
