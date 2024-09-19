const mysql = require('mysql2/promise');
require('dotenv').config();

// Create a pool of connections for MySQL
const pool = mysql.createPool({
  host: process.env.MYSQL_HOST,
  user: process.env.MYSQL_USER,
  password: process.env.MYSQL_PASSWORD,
  database: process.env.MYSQL_DATABASE,
  port: process.env.MYSQL_PORT,
  waitForConnections: true,
  connectionLimit: 10,  // Set the limit of connections (optional)
  queueLimit: 0,        // No limit on the queued connection requests
});

(async () => {
  try {
    const connection = await pool.getConnection();
    console.log('Connected to Railway MySQL database');
    connection.release();  // Release the connection back to the pool
  } catch (err) {
    console.error('Database connection error:', err.stack);
  }
})();

module.exports = pool;
