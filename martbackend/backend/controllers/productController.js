const db = require('../config/db');

// GET all products
exports.getProducts = (req, res) => {
  db.query('SELECT * FROM products', (err, results) => {
    if (err) return res.status(500).json({ error: err });
    res.json(results);
  });
};

// ADD a new product
exports.addProduct = (req, res) => {
  const { name, category, price, stock } = req.body;
  const query = 'INSERT INTO products (name, category, price, stock) VALUES (?, ?, ?, ?)';
  db.query(query, [name, category, price, stock], (err, result) => {
    if (err) return res.status(500).json({ error: err });
    res.json({ message: 'Product added successfully', id: result.insertId });
  });
};

// UPDATE a product
exports.updateProduct = (req, res) => {
  const { id } = req.params;
  const { name, category, price, stock } = req.body;
  const query = 'UPDATE products SET name = ?, category = ?, price = ?, stock = ? WHERE id = ?';
  db.query(query, [name, category, price, stock, id], (err) => {
    if (err) return res.status(500).json({ error: err });
    res.json({ message: 'Product updated successfully' });
  });
};

// DELETE a product
exports.deleteProduct = (req, res) => {
  const { id } = req.params;
  db.query('DELETE FROM products WHERE id = ?', [id], (err) => {
    if (err) return res.status(500).json({ error: err });
    res.json({ message: 'Product deleted successfully' });
  });
};