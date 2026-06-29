require('dotenv').config();
const { db } = require('./src/models/index.model.js');
const { generateClockScores } = require('./src/services/clockService.js');

async function run() {
    try {
        console.log("Testing generateClockScores directly...");
        const data = {
            role: "Senior Backend Developer",
            industry: "Information Technology",
            skills: "Node.js, PostgreSQL, AWS",
            achievements: "Scaled API to 10k RPS. Migrated from Express to Fastify. Reduced cloud costs by 30%.",
            tenure: 2.5
        };
        const clockScores = await generateClockScores(data);
        console.log("Success! Output:");
        console.log(JSON.stringify(clockScores, null, 2));
    } catch (e) {
        console.error("Error generating clocks:", e);
    } finally {
        process.exit(0);
    }
}

run();
