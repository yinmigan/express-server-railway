const dotenv = require("dotenv").config();
const { GoogleGenerativeAI } = require("@google/generative-ai");

const genAI = new GoogleGenerativeAI(process.env.API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash"});


const generateContent = async (req,res,pool)=>{

    try{
        
        const latestData = await pool.query(`
            SELECT date, level
            FROM waterlevel
            WHERE date >= NOW() - INTERVAL '3 hours'
            ORDER BY date DESC
            LIMIT 10;
        `);
        
        var prompt = ""
        if (latestData.rows.length === 0) {
            prompt = "You are a smart flood detector, given water levels you will give advice to when it is dangerous for the people. Since the water level is not high for the past 3 hrs just say It's seems there's no rise in waterlevel as of the moment. You are safe!";
        }
        else {
            //res.json(latestData.rows); // Return the latest record
            const waterLevelDataString = JSON.stringify(latestData.rows);
            const latestwaterLevelDataString = JSON.stringify(latestData.rows[0]);
            prompt = "You are a smart flood detector, given water levels you will give advice to when it is dangerous for the people. " +
                            " If the latest water level which is " + latestwaterLevelDataString +" is less than 50% then you should inform the user that water level is less dangerous as of the moment" +
                            " If the latest water level which is " + latestwaterLevelDataString +"  is more than 50% then you should tell them to prepare for evacuation since it is moderate dangerous." +
                            " But if it more than 80% or you should say it is in dangerous level and they should evacuate. " + 
                            " From this water level data: " + waterLevelDataString + " analyze the water trend." +
                            " Give an estimation to when it will reach a dangerous level(80%) base on the pattern of the data." + 
                            " Please give the direct estimation, do not repeat the data and start your sentence with greeting and saying you are their smart flood detector bot.";
        }
        console.log(prompt)
        const result = await model.generateContent(prompt);
        const response = await result.response;
        const text = response.text();
        res.send(text);
    }
    catch(err){
        console.log(err);
        res.send("Unexpected Error!!!");
    }
}

module.exports = generateContent;
