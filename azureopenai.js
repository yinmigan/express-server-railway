const dotenv = require("dotenv").config();
const axios = require("axios");

const generateContent = async (req, res, pool) => {
    try {
        const latestData = await pool.query(`
            SELECT date, level
            FROM waterlevel
            WHERE date >= NOW() - INTERVAL '3 hours'
            ORDER BY date ASC
            LIMIT 10;
        `);

        var prompt = "";
        if (latestData.rows.length === 0) {
            prompt = "You are a smart flood detector. Given water levels, you will give advice when it is dangerous for people. Since the water level has not update for the past 3 hours, just say 'It seems there's no rise in water level at the moment. You are safe!'";
        } else {
            const waterLevelDataString = JSON.stringify(latestData.rows);
            const latestwaterLevelDataString = JSON.stringify(latestData.rows[latestData.rows.length - 1].level);
            console.log(waterLevelDataString)
            console.log(latestwaterLevelDataString)
            prompt = `You are EARWN (Efficient AI-based real-time water level detection) bot. Start by greeting the user and stating that you're here to provide immediate water level detection guidance.

                        Use the following information to generate your response:
                        1. Current Water Level: ${latestwaterLevelDataString}
                        2. Water Level History: ${waterLevelDataString}
                        
                        Respond based on the following guidelines:
                        1. If the current water level (${latestwaterLevelDataString}) is below 50%, say: "The water level is low and not currently dangerous."
                        2. If the current water level (${latestwaterLevelDataString}) is between 50% and 79%:
                            - If the water level history shows an increasing trend (even small changes), say: "Prepare for potential evacuation." 
                              You provide a concrete (minutes or hour) estimate how long it will take to reach 80%, specify exactly when base on estimation.
                            - If the water level history trend is decreasing, say: "The situation is stable; no immediate danger."
                            - If there has been no increase or decrease in water level history for 10 minutes or more, say: "The water level is stable, and there is no immediate danger."
                        3. If the current water level (${latestwaterLevelDataString}) is 80% or above:
                            - If the water level history shows an increasing trend (even small changes), say: "Evacuate immediately due to high danger." 
                              Provide a concrete (minutes or hour) estimate when it will reach 100%.
                            - If the water level history trend is decreasing, say: "Evacuate immediately due to high danger, but the situation has improve because water level is decreasing."
                              Provide an estimate of the water level for the next minutes or hour.
                            - If there has been no increase or decrease in water level history for 10 minutes or more, say: "Evacuate immediately due to high danger, but the water level appears stable at this high level."
                        4. If the current water level is 100%, simply state: "It is flooding already," and no further estimation is needed.

                        Additional note:
                        Please take note when analyzing the water level history trend be mindful of the date and time, it is very important to determine the correct trend.
                        Do not include any reasoning or unnecessary information. Provide only the status and estimation based on the trends for the current scenario. Avoid saying you cannot estimate the water level. Make the estimation based on available data or imply stability if no change is expected. 
                        Refrain from giving vague estimation like very soon, please be specific with time.
                        Remember always provide guidance solely based on the current water level without including advice for other scenarios. Please avoid specifying the range of water level in your response.
                        Always remember that you must not explain or discuss the guidelines. Just use it to determine the waterlevel.`;
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
            temperature: 0.9
        };

        const headers = {
            'Content-Type': 'application/json',
            'api-key': azureApiKey
        };

        const response = await axios.post(
            //`${azureEndpoint}/openai/deployments/gpt-35-turbo/chat/completions?api-version=2023-03-15-preview`,
            `${azureEndpoint}/openai/deployments/gpt-4/chat/completions?api-version=2023-03-15-preview`,
            requestBody,
            { headers }
        );

        const generatedText = response.data.choices[0].message.content;
        console.log("GEnerated:", generatedText)
        res.send(generatedText);
    } catch (err) {
        console.log(err);
        res.send("There's a system hiccups. Bot is not available this time. ");
    }
}

module.exports = generateContent;