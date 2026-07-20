const mongoose = require('mongoose');
const xlsx = require('xlsx');
const path = require('path');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../../.env') });

const { db } = require('../models/index.model.js');

async function runSeed() {
    try {
        console.log('Connecting to database...');
        await mongoose.connect(process.env.DB_URI, {
            useNewUrlParser: true,
            useUnifiedTopology: true
        });
        console.log('Connected to MongoDB');

        const filePath = path.join(__dirname, '../../doc/hip -doc/00 Hawksyn_HIP_Content_MasterTable.xlsx');
        console.log(`Reading Excel file from ${filePath}`);
        
        const workbook = xlsx.readFile(filePath);
        const sheetName = workbook.SheetNames[0]; // Assuming data is in the first sheet
        const sheet = workbook.Sheets[sheetName];
        
        const rawData = xlsx.utils.sheet_to_json(sheet);
        console.log(`Found ${rawData.length} rows in the Excel file.`);

        const docsToInsert = rawData.map(row => {
            return {
                db_key: row['DB Key'],
                section_id: row['Section ID'],
                chapter_id: String(row['Chapter']), // Force string in case it's parsed as number
                section_name: row['Section Name'],
                band_code: row['Band Code'],
                band_label: row['Band Label'],
                signal_level: String(row['Signal Level']).toUpperCase(),
                headline: row['Headline'] || '',
                content_block: row['Content Block'] || '',
                capability_titles: row['Capability Titles (comma separated)'] || null,
                capability_actions: row['Capability Actions (| separated)'] || null,
                scarcity_titles: row['Scarcity Titles (comma separated)'] || null,
                scarcity_actions: row['Scarcity Actions (| separated)'] || null,
                ref_developer_reference: row['Ref: Developer Reference v4'] || null,
                ref_signal_map: row['Ref: Signal Map v3 Section'] || null,
                pif_check: row['PIF Check'] || null
            };
        }).filter(doc => doc.db_key); // Filter out any empty rows

        console.log(`Prepared ${docsToInsert.length} valid documents for insertion.`);

        // Clear existing data to avoid conflicts
        await db.HipContentMap.deleteMany({});
        console.log('Cleared existing HipContentMap data.');

        // Insert new data
        await db.HipContentMap.insertMany(docsToInsert);
        console.log('Successfully seeded HipContentMap.');

    } catch (error) {
        console.error('Error during seeding:', error);
    } finally {
        await mongoose.disconnect();
        console.log('Disconnected from MongoDB');
    }
}

// Execute if run directly
if (require.main === module) {
    runSeed();
}

module.exports = runSeed;
