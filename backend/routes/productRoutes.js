const express = require('express');
const productController = require('../controllers/productController');
const { requireAdmin } = require('../middleware/authMiddleware');

const router = express.Router();

router.get('/categories', productController.getCategories);
router.get('/', productController.getProducts);
router.post('/', requireAdmin, productController.uploadProductImage, productController.createProduct);
router.put('/:id', requireAdmin, productController.uploadProductImage, productController.updateProduct);
router.delete('/:id', requireAdmin, productController.deleteProduct);

module.exports = router;
