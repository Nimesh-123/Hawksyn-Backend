const { db } = require('../models/index.model.js');
const FourClocks = require('../modules/commandCenter/FourClocks.model');
const ClockContent = require('../modules/commandCenter/ClockContent.model');
const PSDEResult = require('../modules/cv/PSDEResult.model');
const { generateFourClocks } = require('../modules/commandCenter/clockEngine');

async function getClockContent(clockId, conditionId) {
    const records = await ClockContent.find({ clock_id: { $in: [Number(clockId), String(clockId)] }, condition_id: conditionId }).lean();
    const content = {};
    for (const r of records) {
        if (r.element_id) {
            content[r.element_id] = r;
        } else if (r.element_name) {
            content[r.element_name] = r;
        }
    }
    return content;
}

async function buildFourClocksResponse(userId) {
    const clocks = await FourClocks.findOne({ userId }).lean();
    if (!clocks) return null;

    const [c1Content, c2Content, c3Content, c4Content] = await Promise.all([
        getClockContent(1, clocks.clock1.condition_id),
        getClockContent(2, clocks.clock2.condition_id),
        getClockContent(3, clocks.clock3.condition_id),
        getClockContent(4, clocks.clock4.condition_id)
    ]);

    // Fetch contributors details
    const allContributors = [
        ...(clocks.clock1.contributors || []),
        ...(clocks.clock2.contributors || []),
        ...(clocks.clock3.contributors || []),
        ...(clocks.clock4.contributors || [])
    ];
    
    // Contributor records have archetype_id and belong to a clock
    const contributorRecords = await ClockContent.find({ archetype_id: { $in: allContributors } }).lean();

    const getContribs = (clockId, ids) => {
        return (ids || []).map(id => {
            const rec = contributorRecords.find(r => r.archetype_id === id && (String(r.clock_id) === String(clockId) || Number(r.clock_id) === Number(clockId)));
            return rec ? {
                archetype_id: id,
                display_title: rec.display_title,
                display_body: rec.display_body,
                detail_direction_tag: rec.detail_direction_tag
            } : { archetype_id: id };
        });
    };

    return {
        clock1: {
            ...clocks.clock1,
            content: c1Content,
            contributors: getContribs(1, clocks.clock1.contributors)
        },
        clock2: {
            ...clocks.clock2,
            content: c2Content,
            contributors: getContribs(2, clocks.clock2.contributors)
        },
        clock3: {
            ...clocks.clock3,
            content: c3Content,
            contributors: getContribs(3, clocks.clock3.contributors)
        },
        clock4: {
            ...clocks.clock4,
            content: c4Content,
            contributors: getContribs(4, clocks.clock4.contributors)
        },
        lastCalculatedAt: clocks.lastCalculatedAt
    };
}

async function triggerFourClocksRecalculation(userId) {
    // 1. Fetch latest PSDE result
    const psdeResult = await PSDEResult.findOne({ candidate_id: userId }).sort({ createdAt: -1 }).lean();
    if (!psdeResult) {
        throw new Error('No PSDE results found for this user. Cannot calculate clocks.');
    }

    // 2. Fetch User Profile
    const userProfile = await db.UserProfile.findOne({ userId }).lean();
    const profile = userProfile?.confirmedProfile || userProfile?.originalParsedData?.structured || {};

    const psdeArray = psdeResult.archetype_results || [];

    // 3. Run the engine
    const updatedClocks = await generateFourClocks(userId, psdeResult._id.toString(), psdeArray, profile, psdeResult);
    return updatedClocks;
}

module.exports = {
    buildFourClocksResponse,
    triggerFourClocksRecalculation
};
