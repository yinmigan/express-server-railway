const express = require('express');
const cors = require('cors');
const pool = require('./db'); // Import the pool
const generateContent = require("./gemini");
const azureaigenerateContent = require("./azureopenai");
const app = express();
const axios = require('axios');
const port = 8080;  // You can use any port number you prefer

const { GoogleGenerativeAI } = require("@google/generative-ai");
const genAI = new GoogleGenerativeAI(process.env.API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash"});

const azureApiKey = process.env.AZURE_API_KEY;
const azureEndpoint = process.env.AZURE_ENDPOINT;

// Middleware to parse JSON bodies
app.use(express.json());
app.use(cors()); // This will allow all origins

// Define a route for the root URL
app.get('/', (req, res) => {
  res.send('Hello World!');
});

app.get("/gemini", (req, res) => generateContent(req, res, pool));
app.get("/azureopenai", (req, res) => azureaigenerateContent(req, res, pool));

// app.post('/gemini-query', async (req, res) => {
//   const data = req.body;
//   const input = data.prompt;
//   console.log("INPUTTT", input);

//   if (!input) {
//     return res.status(400).json({ error: 'Prompt is required.' });
//   }
  
//   try {
//     const latestData = await pool.query(`
//       SELECT date, level
//       FROM waterlevel
//       WHERE date >= NOW() - INTERVAL '3 hours'
//       ORDER BY date DESC
//       LIMIT 10;
//   `);

//     var prompt = ""
//     if (latestData.rows.length === 0) {
//       prompt = "You are a smart flood detector, given the question " + input + " answer it with the best of your ability. Remember that you don't have water level information for the past 3 hours, so do not answer if the question is related to that, just say you don't have information regarding water level as of the moment.";
//     }
//     else {
//       const waterLevelDataString = JSON.stringify(latestData.rows);
//       const latestwaterLevelDataString = JSON.stringify(latestData.rows[0]);
//       prompt = "Role: You are a smart flood detector, respond only to questions related to flood and environment conditions. You must give advices when to evacuate base on the information given to you. " +
//               " If the water level is less than 50% then the water level is less dangerous. " +
//               " If the water level  is more than 50% then it is moderate dangerous which needs evacuation preparation." +
//               " But if it more than 80% it is in dangerous level and needs to evacuate. " + 
//               " From this water level data: " + waterLevelDataString + " analyze the water trend. Latest water level is " + latestwaterLevelDataString + "This might help in answering the question."  +
//               " If the water level data is not available, just provide a general knowledge, do not just say that you don't have data." +
//               " Please give the direct answer to the question, " + input + " given the information above.";
//     }
//     // Generate content
//     const result = await model.generateContent(prompt);

//     const response = await result.response;
//     const text = response.text();
//     res.send(text);

//   } catch (error) {
//     console.error('Error generating content:', error);
//     res.status(500).json({ error: 'Error generating content.' });
//   }
// });

app.post('/azureopenai-query', async (req, res) => {
  const data = req.body;
  const input = data.prompt;

  console.log("INPUTTT", input);

  if (!input) {
    return res.status(400).json({ error: 'Prompt is required.' });
  }
  
  try {
    // Fetch the latest water level data
    const latestData = await pool.query(`
      SELECT date, level
      FROM waterlevel
      WHERE date >= NOW() - INTERVAL '3 hours'
      ORDER BY date DESC
      LIMIT 10;
    `);

    let prompt = "";
    if (latestData.rows.length === 0) {
      // No water level data in the past 3 hours
      prompt = `You are a smart flood detector. Given the question "${input}", answer it with the best of your ability. 
      Remember that you don't have water level information for the past 3 hours, so do not answer if the question is 
      related to that. Just say you don't have information regarding water level as of the moment.`;
    } else {
      // Water level data available
      const waterLevelDataString = JSON.stringify(latestData.rows);
      const latestWaterLevelDataString = JSON.stringify(latestData.rows[0]);
      prompt = `You are a smart flood detector. Respond only to questions related to flood and environmental conditions. 
      You must give advice on when to evacuate based on the information given to you. 
      If the water level is less than 50%, it is less dangerous. 
      If the water level is more than 50%, it is moderately dangerous, requiring evacuation preparation. 
      If the water level exceeds 80%, it is at a dangerous level, and evacuation is needed. 
      From this water level data: ${waterLevelDataString}, analyze the water trend. The latest water level is ${latestWaterLevelDataString}. 
      Use this information to answer the question: "${input}".`;
    }

    // Prepare the request body for Azure OpenAI
    const requestBody = {
      messages: [
        {
          role: "system",
          content: "You are a smart flood detector."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      max_tokens: 300,
      temperature: 0.7
    };

    // Set up the headers
    const headers = {
      'Content-Type': 'application/json',
      'api-key': azureApiKey
    };

    // Make the API call to Azure OpenAI
    const azureResponse = await axios.post(
      `${azureEndpoint}/openai/deployments/gpt-35-turbo/chat/completions?api-version=2023-03-15-preview`,
      requestBody,
      { headers }
    );

    // Extract the response from Azure OpenAI
    const generatedText = azureResponse.data.choices[0].message.content;
    res.send(generatedText);

  } catch (error) {
    console.error('Error generating content:', error.response ? error.response.data : error.message);
    res.status(500).json({ error: 'Error generating content.' });
  }
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
      WHERE date >= NOW() - INTERVAL '3 hours'
      ORDER BY date DESC
      LIMIT 1;
    `);

    if (latestData.rows.length === 0) {
      return res.json({ data: 0 }); 
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
