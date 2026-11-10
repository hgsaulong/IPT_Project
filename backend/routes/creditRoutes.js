const express = require('express');
const creditController = require('../controllers/creditController');

const router = express.Router();

router.get('/customers', creditController.getCustomers);
router.get('/customers/:customerId/history', creditController.getCustomerHistory);
router.post('/payments', creditController.recordPayment);

module.exports = router;
