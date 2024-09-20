const express = require('express');
const pool = require('./db'); // Import the pool
const app = express();
const port = 8080;  // You can use any port number you prefer

// Middleware to parse JSON bodies
app.use(express.json());

// Define a route for the root URL
app.get('/', (req, res) => {
  res.send('Hello World!');
});


app.get('/get-water-level', async (req, res) => {
  try {
    // Check if the table exists
    const tableExists = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE  table_schema = 'public'
        AND    table_name   = 'waterlevel'
      );
    `);

    if (!tableExists.rows[0].exists) {
      // Table does not exist, create it
      await pool.query(`
        CREATE TABLE waterlevel (
          date TIMESTAMPTZ PRIMARY KEY,
          level NUMERIC
          temperature NUMERIC,
          location VARCHAR(255);
        );
      `);
      return res.status(201).send('Table created');
    }

    // Table exists, fetch the latest data
    const latestData = await pool.query(`
      SELECT * FROM waterlevel
      ORDER BY date DESC
      LIMIT 1;
    `);

    if (latestData.rows.length === 0) {
      return res.status(404).send('No data found');
    }

    res.json(latestData.rows[0]); // Return the latest record

  } catch (err) {
    console.error('Error processing request:', err.stack);
    res.status(500).send('Internal Server Error');
  }
});

// Endpoint to get all water levels for the current month
app.get('/waterlevels-month', async (req, res) => {
  try {
    // Query to get water levels for the current month
    const result = await pool.query(`
      SELECT * 
      FROM waterlevel 
      WHERE date >= date_trunc('month', current_date) 
        AND date < date_trunc('month', current_date) + interval '1 month';
    `);

    // Send the results as JSON
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching water levels:', err.stack);
    res.status(500).send('Internal Server Error');
  }
});

// Endpoint to get all water levels from the past 24 hours
app.get('/waterlevels-last-24-hours', async (req, res) => {
try {
  // Query to get water levels from the last 24 hours
  const result = await pool.query(`
    SELECT * 
    FROM waterlevel 
    WHERE date >= NOW() - INTERVAL '24 hours';
  `);

  // Send the results as JSON
  res.json(result.rows);
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

  // Check if the table exists
  const tableExists = await pool.query(`
    SELECT EXISTS (
      SELECT FROM information_schema.tables 
      WHERE  table_schema = 'public'
      AND    table_name   = 'waterlevel'
    );
  `);

  if (!tableExists.rows[0].exists) {
    // Table does not exist, create it
    await pool.query(`
      CREATE TABLE waterlevel (
        date TIMESTAMPTZ PRIMARY KEY,
        level NUMERIC
        temperature NUMERIC,
        location VARCHAR(255);
      );
    `);
    return res.status(201).send('Table created');
  }

  // Validate input data
  if (!date || !level || !temperature || !location) {
    return res.status(400).send('Missing required fields');
  }

  // Insert data into the waterlevel table
  const result = await pool.query(`
    INSERT INTO waterlevel (date, level, temperature, location)
    VALUES ($1, $2, $3, $4)
    ON CONFLICT (date) DO UPDATE 
    SET level = EXCLUDED.level,
        temperature = EXCLUDED.temperature,
        location = EXCLUDED.location;
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
