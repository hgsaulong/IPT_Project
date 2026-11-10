const express = require('express');
const cors = require('cors');
const productRoutes = require('./routes/productRoutes');
const authRoutes = require('./routes/authRoutes');
const db = require('./config/db');


const app = express();
app.use(express.json());
const PORT = 3001;

// Middleware to parse JSON body data
app.use(express.json()); // Use express.json() only

// Enable Cross-Origin Resource Sharing (CORS)
app.use(cors());

// Middleware to handle URL-encoded data (optional, if needed for form data)
app.use(express.urlencoded({ extended: true }));

// Set up routes
app.use('/api/products', productRoutes);
app.use('/api/auth', authRoutes);

app.get('/api/products/:id', (req, res) => {
    const { id } = req.params;
    db.query('SELECT * FROM products WHERE id = ?', [id], (err, result) => {
        if (err) return res.status(500).send(err);
        if (result.length === 0) return res.status(404).send('Product not found');
        res.json(result[0]);
    });
});

app.post('/api/auth/login', (req, res) => {
  const { username, password } = req.body;

  // Dummy check (replace with database logic)
  if (username === 'admin' && password === 'admin123') {
    return res.json({
      token: 'dummy-token',
      user: { id: 1, username: 'admin' }
    });
  } else {
    return res.status(401).json({ message: 'Invalid credentials' });
  }
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ message: 'Internal server error', error: err.message });
});

// Start the server
app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});