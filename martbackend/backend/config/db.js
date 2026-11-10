const mysql = require('mysql2');

const db = mysql.createConnection({
  host: 'localhost', // Database host
  user: 'root',      // Your MySQL username
  password: '',      // Your MySQL password
  database: 'bili' // Your database name
});

db.connect((err) => {
  if (err) {
    console.error('Database connection failed: ' + err.stack);
    return;
  }
  console.log('Connected to the MySQL database');
});

module.exports = db;