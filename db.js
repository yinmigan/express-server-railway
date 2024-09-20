// server.js or db.js

const { Pool } = require('pg');
require('dotenv').config();

// Create a new pool of connections
const pool = new Pool({
  user: process.env.PG_USER,
  host: process.env.PG_HOST,
  database: process.env.PG_DATABASE,
  password: process.env.PG_PASSWORD,
  port: process.env.PG_PORT,
  ssl: {
    rejectUnauthorized: false, // Set this to true in production
  },
});

// Test the connection
pool.connect()
  .then(client => {
    console.log('Connected to PostgreSQL database');
    client.release();
  })
  .catch(err => {
    console.error('Database connection error:', err.stack);
  });

module.exports = pool;
