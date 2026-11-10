const express = require('express');
const router = express.Router();
const db = require('../config/db');
const authenticateToken = require('../middleware/authMiddleware');
const productController = require('../controllers/productController');


router.get('/', productController.getProducts);
router.post('/', productController.addProduct);
router.put('/:id', productController.updateProduct);
router.delete('/:id', productController.deleteProduct);


router.post('/sell', (req, res) => {
  const items = req.body.items; 
  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ message: 'No items provided for sale.' });
  }

  const totalPrice = items.reduce((sum, item) => sum + item.quantity * item.price, 0);

  const insertSale = 'INSERT INTO sales (total_price) VALUES (?)';
  db.query(insertSale, [totalPrice], (err, saleResult) => {
    if (err) return res.status(500).json({ message: 'Sale insert error', error: err });

    const saleId = saleResult.insertId;

    const insertSaleItem = 'INSERT INTO sale_items (sale_id, product_id, quantity, price) VALUES ?';
    const saleItemValues = items.map(i => [saleId, i.id, i.quantity, i.price]);

    const stockUpdates = items.map(item => {
      return new Promise((resolve, reject) => {
        const update = 'UPDATE products SET stock = stock - ? WHERE id = ? AND stock >= ?';
        db.query(update, [item.quantity, item.id, item.quantity], (err, result) => {
          if (err || result.affectedRows === 0) {
            return reject(`Insufficient stock for product ID ${item.id}`);
          }
          resolve();
        });
      });
    });

    Promise.all(stockUpdates)
      .then(() => {
        db.query(insertSaleItem, [saleItemValues], (err) => {
          if (err) {
            return res.status(500).json({ message: 'Failed to record sale items', error: err });
          }
          res.status(200).json({ message: 'Sale completed successfully' });
        });
      })
      .catch(error => {
        res.status(400).json({ message: error });
      });
  });
});


router.get('/sales/total-today', (req, res) => {
  const query = `
    SELECT SUM(total_price) AS total_sales
    FROM sales
    WHERE DATE(sale_time) = CURDATE()
  `;
  db.query(query, (err, results) => {
    if (err) return res.status(500).json({ message: 'Error fetching total sales', error: err });
    const total = results[0].total_sales || 0;
    res.json({ total_sales: total });
  });
});


router.get('/sales/history', (req, res) => {
  const sql = `
    SELECT s.id AS sale_id, s.total_price, s.sale_time,
           p.name AS product_name, si.quantity, si.price
    FROM sales s
    JOIN sale_items si ON s.id = si.sale_id
    JOIN products p ON si.product_id = p.id
    ORDER BY s.sale_time DESC
  `;

  db.query(sql, (err, results) => {
    if (err) return res.status(500).json({ error: 'Database error', err });

    const salesMap = {};

    results.forEach(row => {
      const saleId = row.sale_id;

      if (!salesMap[saleId]) {
        salesMap[saleId] = {
          id: saleId,
          total_price: row.total_price,
          sale_time: row.sale_time,
          products: []
        };
      }

      salesMap[saleId].products.push({
        product_name: row.product_name,
        quantity: row.quantity,
        price: row.price
      });
    });

    const groupedSales = Object.values(salesMap);
    res.json(groupedSales);
  });
});


router.get('/sales/:id/receipt', (req, res) => {
  const saleId = req.params.id;
  const sql = `
    SELECT s.id, s.total_price, s.sale_time, si.quantity, si.price, p.name AS product_name
    FROM sales s
    JOIN sale_items si ON s.id = si.sale_id
    JOIN products p ON si.product_id = p.id
    WHERE s.id = ?
  `;
  db.query(sql, [saleId], (err, results) => {
    if (err) return res.status(500).json({ message: 'Error fetching receipt', error: err });
    if (results.length === 0) return res.status(404).json({ message: 'Sale not found' });
    res.json(results);
  });
});


router.post('/login', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ message: 'Username and password are required' });
  }

  db.query('SELECT * FROM users WHERE username = ?', [username], (err, results) => {
    if (err) return res.status(500).json({ error: err });
    if (results.length === 0) {
      return res.status(404).json({ message: 'User not found' });
    }
    res.json({ message: 'Login successful' });
  });
});


router.post('/products', authenticateToken, (req, res) => {
  const { name, price, quantity } = req.body;
  if (!name || !price || !quantity) {
    return res.status(400).json({ message: 'All fields are required' });
  }

  const query = 'INSERT INTO products (name, price, quantity) VALUES (?, ?, ?)';
  db.query(query, [name, price, quantity], (err, result) => {
    if (err) return res.status(500).json({ message: 'Database error', error: err });
    res.status(201).json({ message: 'Product added successfully', productId: result.insertId });
  });
});


router.post('/add-stock', (req, res) => {
  const { productId, quantityToAdd } = req.body;
  const query = 'UPDATE products SET stock = stock + ? WHERE id = ?';
  db.query(query, [quantityToAdd, productId], (err, results) => {
    if (err) return res.status(500).json({ message: 'Error updating stock', error: err });
    res.json({ message: 'Stock updated successfully' });
  });
});


router.get('/products/:id', (req, res) => {
  const id = req.params.id;
  db.query('SELECT * FROM products WHERE id = ?', [id], (err, result) => {
    if (err) return res.status(500).json({ error: 'DB error' });
    if (result.length === 0) return res.status(404).json({ error: 'Not found' });
    res.json(result[0]);
  });
});


router.delete('/products/:id', (req, res) => {
  const id = req.params.id;
  db.query('DELETE FROM products WHERE id = ?', [id], (err, result) => {
    if (err) return res.status(500).json({ error: 'Delete failed' });
    res.json({ message: 'Product deleted' });
  });
});


router.get('/sales/total-range', (req, res) => {
  const { start, end } = req.query;
  if (!start || !end) {
    return res.status(400).json({ message: 'Start and end dates are required' });
  }

  const query = `
    SELECT SUM(total_price) AS total_sales
    FROM sales
    WHERE DATE(sale_time) BETWEEN ? AND ?
  `;
  db.query(query, [start, end], (err, result) => {
    if (err) return res.status(500).json({ message: 'Error fetching range', error: err });
    res.json({ total_sales: result[0].total_sales || 0 });
  });
});

module.exports = router;
