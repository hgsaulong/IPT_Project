const db = require('../config/db'); // Database configuration

exports.login = (req, res) => {
  const { username, password } = req.body;

  // Directly compare plain-text username and password
  const query = 'SELECT * FROM users WHERE username = ? AND password = ?';

  db.query(query, [username, password], (err, results) => {
    if (err) {
      console.error('Database query error:', err);
      return res.status(500).json({ message: 'Database error', error: err });
    }

    if (results.length === 0) {
      console.log(`Invalid login attempt for username: ${username}`);
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    const user = results[0];
    console.log('Login successful:', user.username);
    res.status(200).json({ message: 'Login successful', user });
  });
};