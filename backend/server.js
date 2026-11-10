require('dotenv').config();
const express = require("express");
const cors = require("cors");
const path = require("path");
const db = require("./db");
const authRoutes = require('./routes/authRoutes');
const productRoutes = require('./routes/productRoutes');
const salesRoutes = require('./routes/salesRoutes');
const creditRoutes = require('./routes/creditRoutes');
const reportRoutes = require('./routes/reportRoutes');
const { authenticateToken } = require('./middleware/authMiddleware');

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));
app.use('/api/auth', authRoutes);
app.use('/api/products', authenticateToken, productRoutes);
app.use('/api/sales', authenticateToken, salesRoutes);
app.use('/api/credit', authenticateToken, creditRoutes);
app.use('/api/reports', authenticateToken, reportRoutes);

app.get("/", (req, res) => {
    res.json({
        message: "Bili-Bili backend is working!"
    });
});

app.get("/users", authenticateToken, (req, res) => {
    db.query("SELECT id, username FROM users", (err, results) => {
        if (err) {
            console.error("Database error:", err);

            return res.status(500).json({
                error: "Database error"
            });
        }

        res.json(results);
    });
});

const PORT = 3001;

app.use((err, req, res, next) => {
    if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({ message: 'Product images must be 5 MB or smaller.' });
    }
    if (err.code === 'LIMIT_UNEXPECTED_FILE' || err.message === 'Only JPEG, PNG, and WebP images are allowed.') {
        return res.status(400).json({ message: err.message });
    }

    console.error('Request failed:', err);
    return res.status(err.status || 500).json({
        message: err.status ? err.message : 'The request could not be completed.'
    });
});

app.listen(PORT, () => {
    console.log(`Bili-Bili backend running on http://localhost:${PORT}`);
});