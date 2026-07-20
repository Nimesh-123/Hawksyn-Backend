const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');
const hipService = require('./src/modules/hip/hip.service');
const { db } = require('./src/models/index.model');

dotenv.config({ path: path.join(__dirname, '.env') });

async function testGeneration() {
    try {
        console.log('Connecting to database...');
        await mongoose.connect(process.env.DB_URI, {
            useNewUrlParser: true,
            useUnifiedTopology: true
        });

        // Find a User that also has a PSDE result
        const psdeList = await db.PSDEResult.find({}).limit(50);
        let validUserId = null;
        for (const p of psdeList) {
            if (!mongoose.Types.ObjectId.isValid(p.candidate_id)) continue;
            const u = await db.User.findById(p.candidate_id);
            if (u) {
                validUserId = p.candidate_id;
                break;
            }
        }
        
        if (!validUserId) {
            console.log('No valid user with PSDE found.');
            return;
        }

        console.log(`Found candidate: ${validUserId}`);
        
        console.log('Generating HIP Profile...');
        const profile = await hipService.generateHipProfile(validUserId);
        
        console.log('--- GENERATED PROFILE (truncated) ---');
        console.log('Slug:', profile.profileSlug);
        console.log('Status:', profile.status);
        console.log('Sections Data Keys:', Object.keys(profile.sectionsData).slice(0, 5), '...');
        
        const firstSectionKey = Object.keys(profile.sectionsData)[0];
        if (firstSectionKey) {
            console.log(`Sample Section [${firstSectionKey}]:`, JSON.stringify(profile.sectionsData[firstSectionKey], null, 2));
        }

    } catch (err) {
        console.error('Error:', err);
    } finally {
        await mongoose.disconnect();
    }
}

testGeneration();
