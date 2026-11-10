const express = require('express');
const productController = require('../controllers/productController');

const router = express.Router();

router.get('/categories', productController.getCategories);
router.get('/', productController.getProducts);
router.post('/', productController.uploadProductImage, productController.createProduct);
router.put('/:id', productController.uploadProductImage, productController.updateProduct);
router.delete('/:id', productController.deleteProduct);

module.exports = router;
