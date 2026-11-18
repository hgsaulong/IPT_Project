const express = require('express');
const reportController = require('../controllers/reportController');
const { requireAdmin } = require('../middleware/authMiddleware');

const router = express.Router();

router.get('/sales', requireAdmin, reportController.getSalesReport);

module.exports = router;
