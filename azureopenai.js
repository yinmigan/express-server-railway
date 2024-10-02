const dotenv = require("dotenv").config();
const axios = require("axios");

const generateContent = async (req, res, pool) => {
    try {
        const latestData = await pool.query(`
            SELECT date, level
            FROM waterlevel
            WHERE date >= NOW() - INTERVAL '3 hours'
            ORDER BY date DESC
            LIMIT 10;
        `);

        var prompt = "";
        if (latestData.rows.length === 0) {
            prompt = "You are a smart flood detector. Given water levels, you will give advice when it is dangerous for people. Since the water level has not risen for the past 3 hours, just say 'It seems there's no rise in water level at the moment. You are safe!'";
        } else {
            const waterLevelDataString = JSON.stringify(latestData.rows);
            const latestwaterLevelDataString = JSON.stringify(latestData.rows[0]);
            prompt = `You are a smart flood detector. Given water levels, you will give advice when it is dangerous for people. 
                      If the latest water level, which is ${latestwaterLevelDataString}, is less than 50%, inform the user that the water level is less dangerous at the moment. 
                      If the latest water level is more than 50%, tell them to prepare for evacuation since it is moderately dangerous. 
                      If it is more than 80%, tell them it is in a dangerous level, and they should evacuate. 
                      Based on this water level data: ${waterLevelDataString}, analyze the water trend and give an estimation of when it will reach a dangerous level (80%) based on the pattern of the data. 
                      Please give a direct estimation, do not repeat the data, and start your sentence with a greeting, saying you are their smart flood detector bot.`;
        }

        console.log(prompt);

        // Prepare the API request to Azure OpenAI
        const azureApiKey = process.env.AZURE_API_KEY;
        const azureEndpoint = process.env.AZURE_ENDPOINT; // Example: 'https://your-resource-name.openai.azure.com'

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

        const headers = {
            'Content-Type': 'application/json',
            'api-key': azureApiKey
        };

        const response = await axios.post(
            `${azureEndpoint}/openai/deployments/gpt-35-turbo/chat/completions?api-version=2023-03-15-preview`,
            requestBody,
            { headers }
        );

        const generatedText = response.data.choices[0].message.content;
        res.send(generatedText);
    } catch (err) {
        console.log(err);
        res.send("Unexpected Error!!! " + err);
    }
}

module.exports = generateContent;