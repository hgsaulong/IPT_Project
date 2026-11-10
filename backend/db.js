const mysql = require("mysql2");

const db = mysql.createPool({
    host: process.env.DB_HOST || "localhost",
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER || "root",
    password: process.env.DB_PASSWORD || "",
    database: process.env.DB_NAME || "bili_bili",
    dateStrings: true,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

db.getConnection((err, connection) => {
    if (err) {
        console.error("MySQL connection failed:", err);
        return;
    }

    console.log("Connected to Bili-Bili MySQL database!");
    connection.release();
});

module.exports = db;