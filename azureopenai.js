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
            prompt = "You are a smart flood detector. Given water levels, you will give advice when it is dangerous for people. Since the water level has not update for the past 3 hours, just say 'It seems there's no rise in water level at the moment. You are safe!'";
        } else {
            const waterLevelDataString = JSON.stringify(latestData.rows);
            const latestwaterLevelDataString = JSON.stringify(latestData.rows[0]);
            prompt = `You are a smart flood detection bot. Based on the water level data, your task is to provide clear guidance on the current danger level and estimate future risks.
                        -If the latest water level (${latestwaterLevelDataString}) is below 50%, inform the user that the water level is currently low and not dangerous.
                        -If it is between 50% and 80%, advise the user to prepare for potential evacuation, as the situation is becoming moderately dangerous.
                        -If it exceeds 80%, strongly advise immediate evacuation due to the high danger.
                    Additionally, based on the trend of the water levels (${waterLevelDataString}), estimate when the water level will reach 80%, marking the dangerous threshold. If the latest water level is already above 80%, provide an estimation of when it may reach 100%, signaling an imminent flood. If the water level has already hit 100%, simply state: 'It is flooding already' without further estimation.
                    Please begin with a greeting, acknowledging that you are their smart flood detection bot, and deliver the estimation clearly and concisely without repeating the provided data.`;
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