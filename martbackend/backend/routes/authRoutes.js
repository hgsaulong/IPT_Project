const express = require('express');
const jwt = require('jsonwebtoken');
const db = require('../config/db');

const router = express.Router();

router.post('/login', (req, res) => {
  const { username, password } = req.body;

  const query = 'SELECT * FROM users WHERE username = ?';
  db.query(query, [username], (err, results) => {
    if (err) {
      return res.status(500).json({ message: 'Database error', error: err });
    }

    if (results.length === 0) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    const user = results[0];

   
    if (user.password !== password) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    const token = jwt.sign(
      { userId: user.id, username: user.username },
      'your_secret_key',
      { expiresIn: '1h' }
    );


    const { password: dbPassword, ...userWithoutPassword } = user;

    res.json({
      message: 'Login successful',
      token,
      user: userWithoutPassword
    });
  });
});

module.exports = router;