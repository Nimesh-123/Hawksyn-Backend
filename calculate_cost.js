const mongoose = require('mongoose');
const dotenv = require('dotenv');
const { calculateAICost } = require('./src/modules/admin/helpers/aiCostHelper');
const { db } = require('./src/models/index.model');

dotenv.config({ path: '.env' });

async function run() {
    try {
        await mongoose.connect(process.env.DB_URI);
        console.log('Connected to DB');
        
        const docs = await db.DocumentUploads.find({ parserMetadata: { $exists: true, $ne: null } }).lean();
        let cvTokens = { prompt: 0, completion: 0, count: 0, cost: 0 };
        docs.forEach(d => {
            const usage = d.parserMetadata?.tokenUsage;
            if (usage) {
                const p = usage.promptTokens || usage.input_tokens || usage.promptTokenCount || 0;
                const c = usage.completionTokens || usage.output_tokens || usage.candidatesTokenCount || 0;
                cvTokens.prompt += p;
                cvTokens.completion += c;
                cvTokens.count++;
                cvTokens.cost += calculateAICost(d.parserMetadata.model || 'Gemini', { promptTokens: p, completionTokens: c });
            }
        });
        
        const clocks = await db.ClockHistory.find({}).lean();
        let clockTokens = { prompt: 0, completion: 0, count: 0, cost: 0 };
        clocks.forEach(c => {
            const usage = c.tokenUsage;
            if (usage) {
                const p = usage.promptTokens || usage.input_tokens || usage.promptTokenCount || 0;
                const comp = usage.completionTokens || usage.output_tokens || usage.candidatesTokenCount || 0;
                clockTokens.prompt += p;
                clockTokens.completion += comp;
                clockTokens.count++;
                clockTokens.cost += calculateAICost(c.model || 'Gemini', { promptTokens: p, completionTokens: comp });
            }
        });
        
        // Find HipContentMap or PSDE runs to get HIP Building cost
        const userProfiles = await db.UserProfile.find({ 'hipProfile.metadata.tokenUsage': { $exists: true } }).lean();
        let hipTokens = { prompt: 0, completion: 0, count: 0, cost: 0 };
        userProfiles.forEach(u => {
            const usage = u.hipProfile?.metadata?.tokenUsage;
            if (usage) {
                const p = usage.promptTokens || usage.input_tokens || usage.promptTokenCount || 0;
                const comp = usage.completionTokens || usage.output_tokens || usage.candidatesTokenCount || 0;
                hipTokens.prompt += p;
                hipTokens.completion += comp;
                hipTokens.count++;
                hipTokens.cost += calculateAICost('Gemini', { promptTokens: p, completionTokens: comp }); // Assuming Gemini for HIP
            }
        });

        console.log('--- AVERAGE PER OPERATION ---');
        console.log('CV Parsing Avg Tokens:', cvTokens.count > 0 ? (cvTokens.prompt + cvTokens.completion) / cvTokens.count : 0);
        console.log('CV Parsing Avg Cost ($):', cvTokens.count > 0 ? cvTokens.cost / cvTokens.count : 0);
        
        console.log('Clock Activation Avg Tokens:', clockTokens.count > 0 ? (clockTokens.prompt + clockTokens.completion) / clockTokens.count : 0);
        console.log('Clock Activation Avg Cost ($):', clockTokens.count > 0 ? clockTokens.cost / clockTokens.count : 0);
        
        console.log('HIP Building Avg Tokens:', hipTokens.count > 0 ? (hipTokens.prompt + hipTokens.completion) / hipTokens.count : 0);
        console.log('HIP Building Avg Cost ($):', hipTokens.count > 0 ? hipTokens.cost / hipTokens.count : 0);

        console.log('--- TOTAL AGGREGATES ---');
        console.log('CV Tokens Total:', cvTokens.prompt + cvTokens.completion);
        console.log('CV Cost Total ($):', cvTokens.cost);

    } catch (e) {
        console.error(e);
    } finally {
        await mongoose.disconnect();
    }
}
run();
