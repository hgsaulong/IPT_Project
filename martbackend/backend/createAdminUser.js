const mysql = require('mysql2');
const bcrypt = require('bcrypt');


const db = mysql.createConnection({
  host: 'localhost',
  user: 'root',
  password: '',
  database: 'mini_pos'
});


const username = 'Mart1';
const plainPassword = 'mart123';


db.query('SELECT * FROM users WHERE username = ?', [username], (err, results) => {
  if (err) {
    console.error('Database error:', err);
    db.end();
    return;
  }

  if (results.length > 0) {
    console.log(`User "${username}" already exists!`);
    db.end();
  } else {

    bcrypt.hash(plainPassword, 10, (err, hashedPassword) => {
      if (err) {
        console.error('Error hashing password:', err);
        db.end();
        return;
      }

      const query = 'INSERT INTO users (username, password) VALUES (?, ?)';
      db.query(query, [username, hashedPassword], (err, result) => {
        if (err) {
          console.error('Insert error:', err);
        } else {
          console.log(`User "${username}" created with hashed password!`);
        }
        db.end();
      });
    });
  }
});
