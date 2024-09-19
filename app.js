const express = require('express');
const pool = require('./db'); // Import the pool
const app = express();
const port = 3200;  // You can use any port number you prefer

// Middleware to parse JSON bodies
app.use(express.json());

// Define a route for the root URL
app.get('/', (req, res) => {
  res.send('Hello World!');
});


app.get('/get-water-level', async (req, res) => {
  try {
    // Check if the table exists in MySQL
    const tableExists = await pool.query(`
      SELECT COUNT(*)
      FROM information_schema.tables 
      WHERE table_name = 'waterlevel'
    `);

    if (tableExists[0][0]['COUNT(*)'] === 0) {
      // Table does not exist, create it
      await pool.query(`
        CREATE TABLE waterlevel (
          id INT AUTO_INCREMENT PRIMARY KEY,
          date TIMESTAMP,
          level DECIMAL(10,2),
          temperature DECIMAL(10,2),
          location VARCHAR(255)
        );
      `);
      return res.status(201).send('Table created');
    }

    // Table exists, fetch the latest data
    const [latestData] = await pool.query(`
      SELECT * FROM waterlevel
      ORDER BY date DESC
      LIMIT 1;
    `);

    if (latestData.length === 0) {
      return res.status(404).send('No data found');
    }

    res.json(latestData[0]); // Return the latest record

  } catch (err) {
    console.error('Error processing request:', err.stack);
    res.status(500).send('Internal Server Error');
  }
  });

// Endpoint to get all water levels for the current month
app.get('/waterlevels-month', async (req, res) => {
  try {
    // Query to get water levels for the current month
    const [result] = await pool.query(`
      SELECT * 
      FROM waterlevel 
      WHERE DATE(date) >= DATE_FORMAT(CURDATE(), '%Y-%m-01')
        AND DATE(date) < DATE_ADD(DATE_FORMAT(CURDATE(), '%Y-%m-01'), INTERVAL 1 MONTH);
    `);

    // Send the results as JSON
    res.json(result);
  } catch (err) {
    console.error('Error fetching water levels:', err.stack);
    res.status(500).send('Internal Server Error');
  }
});

  // Endpoint to get all water levels from the past 24 hours
app.get('/waterlevels-last-24-hours', async (req, res) => {
  try {
    // Query to get water levels from the last 24 hours
    const [result] = await pool.query(`
      SELECT * 
      FROM waterlevel 
      WHERE date >= NOW() - INTERVAL 1 DAY;
    `);

    // Send the results as JSON
    res.json(result);
  } catch (err) {
    console.error('Error fetching water levels:', err.stack);
    res.status(500).send('Internal Server Error');
  }
});
  
// POST endpoint to add data
app.post('/add-water-level', async (req, res) => {
  try {
    // Extract data from request body
    const { date, level, temperature, location } = req.body;

    // Validate input data
    if (!date || !level || !temperature || !location) {
      return res.status(400).send('Missing required fields');
    }

    // Check if the table exists
    const [tableExists] = await pool.query(`
      SELECT COUNT(*)
      FROM information_schema.tables
      WHERE table_name = 'waterlevel'
    `);

    if (tableExists[0]['COUNT(*)'] === 0) {
      // Table does not exist, create it
      await pool.query(`
        CREATE TABLE waterlevel (
          id INT AUTO_INCREMENT PRIMARY KEY,
          date TIMESTAMP NOT NULL,
          level DECIMAL(10, 2),
          temperature DECIMAL(10, 2),
          location VARCHAR(255)
        );
      `);
      return res.status(201).send('Table created');
    }

    // Insert data into the waterlevel table, or update it if date already exists
    const result = await pool.query(`
      INSERT INTO waterlevel (date, level, temperature, location)
      VALUES (?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE 
        level = VALUES(level),
        temperature = VALUES(temperature),
        location = VALUES(location);
    `, [date, level, temperature, location]);

    res.status(201).send('Data added successfully');
  } catch (err) {
    console.error('Error processing request:', err.stack);
    res.status(500).send('Internal Server Error');
  }
});

// Start the server
app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});
