/**
 * reportHelpers.js — Shared logic for Step 6: Report Generation
 * Consolidates mapping, filling, and RAG contexts.
 */

/**
 * PII anonymization to keep Gold Standard data safe.
 */
const anonymizeReport = (reportJson) => {
    try {
        let str = JSON.stringify(reportJson);
        str = str.replace(/\b[A-Z][a-z]+ [A-Z][a-z]+\b/g, 'CANDIDATE_NAME');
        str = str.replace(/[\w._%+-]+@[\w.-]+\.[a-zA-Z]{2,}/g, 'candidate@example.com');
        str = str.replace(/\b(\+91[\-\s]?)?[6-9]\d{9}\b/g, 'XXXXXXXX');
        return JSON.parse(str);
    } catch { return {}; }
};

/**
 * Resolve deep values from profile snapshot.
 */
const getDeepValue = (obj, path) => {
    if (!obj || !path) return null;
    return path.split('.').reduce((acc, part) => acc && acc[part], obj);
};

/**
 * Global placeholders mapping for all reports.
 */
const buildPlaceholderMap = (profileSnapshot, rasAnswers, questionsMap, integrityPack, externalSignals) => {
    const answerLabelMap = {};
    for (const ans of (rasAnswers || [])) {
        const { answerValue, answerLabel, questionId } = ans;
        if (answerLabel) {
            answerLabelMap[questionId] = answerLabel;
            continue;
        }
        const q = questionsMap[questionId];
        if (q && q.questionType === 'MCQ' && Array.isArray(q.optionsJson)) {
            const numericValue = Number(answerValue);
            const opt = q.optionsJson.find(o => 
                Number(o.score) === numericValue || 
                String(o.opt).toLowerCase() === String(answerValue).toLowerCase()
            );
            answerLabelMap[questionId] = opt ? opt.opt : String(answerValue);
        } else {
            answerLabelMap[questionId] = String(answerValue ?? '');
        }
    }

    const currentRole = profileSnapshot.current_role 
        || profileSnapshot.identity?.currentRole 
        || profileSnapshot.identity?.fullName 
        || 'Not provided';

    const experienceYears = profileSnapshot.experience_years 
        || profileSnapshot.work?.totalYearsExperience 
        || (profileSnapshot.work?.experience?.[0]?.duration)
        || 'Not provided';

    const redFlagsSummary = (integrityPack.redFlags?.triggered || [])
        .map(rf => `${rf.redFlagName} (${rf.severityBand})`)
        .join(', ') || 'None';

    const contradictionsSummary = (integrityPack.contradictions?.triggered || [])
        .map(c => c.contradictionName)
        .join(', ') || 'None';

    const skills = Array.isArray(profileSnapshot.skills)
        ? profileSnapshot.skills.join(', ')
        : (profileSnapshot.skills || 'Not provided');

    const baseMap = {
        CURRENT_ROLE:      currentRole,
        EXPERIENCE_YEARS:  String(experienceYears),
        SKILLS:            skills,
        CURRENT_COMPANY:   profileSnapshot.current_company || profileSnapshot.work?.experience?.[0]?.company || 'Not provided',
        DOMAIN:            profileSnapshot.domain          || profileSnapshot.parsedData?.domain || 'Not provided',
        ACCURACY_SCORE:    String(integrityPack.accuracy?.score  || 0),
        ACCURACY_BAND:     integrityPack.accuracy?.band           || 'UNKNOWN',
        RED_FLAGS:         redFlagsSummary,
        CONTRADICTIONS:    contradictionsSummary,
        TOTAL_PENALTY:     String(integrityPack.accuracy?.totalPenalty || 0),
        'MARKET_DEMAND_SIGNAL':    externalSignals?.marketDemandSignal?.value    || 'NOT_AVAILABLE',
        'MARKET_DEMAND_RATIONALE': externalSignals?.marketDemandSignal?.rationale || 'No market data available.',
        'AI_DISPLACEMENT_RISK':    externalSignals?.aiDisplacementRisk?.value     || 'NOT_AVAILABLE',
        'AI_DISPLACEMENT_RATIONALE': externalSignals?.aiDisplacementRisk?.rationale || 'No AI risk data available.',
        'INDUSTRY_HIRING_TREND':   externalSignals?.industryHiringTrend?.value    || 'NOT_AVAILABLE',
        'AUTOMATION_OVERLAP':      String(externalSignals?.automationOverlapScore?.value ?? 'NOT_AVAILABLE'),
        'SIGNAL_DATA_QUALITY':     externalSignals?.dataQuality                   || 'INSUFFICIENT',
        'ANALYST_NOTE':            externalSignals?.analystNote                   || 'Insufficient market data for this profile.',
    };

    // Legacy Question IDs mapping
    for (const [qId, label] of Object.entries(answerLabelMap)) {
        baseMap[qId] = label;
    }

    return baseMap;
};

/**
 * fillPrompt — Placeholder replacement engine.
 */
const fillPrompt = (template, placeholders) => {
    let result = template;
    for (const [key, val] of Object.entries(placeholders)) {
        result = result.replaceAll(`{{${key}}}`, val ?? 'Not provided');
    }
    return result;
};

/**
 * Anchor Coverage check.
 */
const checkAnchors = (section, integrityPack, externalCoverage) => {
    const internalAnchors = section.requiredInternalAnchorsJson || [];
    const externalAnchors = section.requiredExternalAnchorsJson || [];

    const internalResults = integrityPack.coverage?.results || [];
    const missingInternal = internalAnchors.filter(anchor => {
        const result = internalResults.find(c => c.anchor === anchor || c.anchorName === anchor);
        return !result || result.sufficiency === 'NOT_FOUND';
    });

    const missingExternal = externalAnchors.filter(anchor => {
        const result = (externalCoverage || []).find(c => c.anchor === anchor);
        return !result || result.sufficiency === 'NOT_FOUND';
    });

    return {
        allCovered: missingInternal.length === 0 && missingExternal.length === 0,
        missingInternal,
        missingExternal
    };
};

/**
 * applyCertaintyCap — Soften overconfident language if accuracy is low.
 */
const applyCertaintyCap = (text, capPercent, accuracyBand) => {
    if (capPercent < 85 || ['LOW', 'VERY_LOW'].includes(accuracyBand)) {
        text = text
            .replace(/\bdefinitely\b/gi,    'likely')
            .replace(/\bcertainly\b/gi,     'probably')
            .replace(/\bwill definitely\b/gi, 'may')
            .replace(/\bguaranteed\b/gi,    'expected')
            .replace(/\bwithout doubt\b/gi, 'likely');
    }

    if (['LOW', 'VERY_LOW'].includes(accuracyBand)) {
        text = `[Limited data confidence — Accuracy Band: ${accuracyBand}]\n\n` + text;
    }
    return text;
};

/**
 * extractVerdict — LLM response parser for final decision.
 */
const extractVerdict = (text) => {
    const upper = text.toUpperCase();
    if (upper.includes('ABORT'))   return 'ABORT';
    if (upper.includes('PROCEED')) return 'PROCEED';
    if (upper.includes('PAUSE'))   return 'PAUSE';
    return 'PAUSE'; 
};

module.exports = {
    anonymizeReport,
    getDeepValue,
    buildPlaceholderMap,
    fillPrompt,
    checkAnchors,
    applyCertaintyCap,
    extractVerdict,

    /**
     * RAG HELPER — Fetch Gold Standard Reports
     */
    getGoldStandardExamples: async (db, caseId, intentId, limit = 3) => {
        try {
            const examples = await db.Ras.find({
                artifactType: 'FINAL_REPORT',
                status: 'FINAL',
                qualityRating: 5,
                'artifactJson.caseId': caseId,
                'artifactJson.intentId': intentId
            })
            .sort({ qualityRatedAt: -1 })
            .limit(limit)
            .lean();

            return examples.map(ex => (ex.artifactJson));
        } catch (err) {
            console.warn('[RAG] No Gold Standards found:', err.message);
            return [];
        }
    }
};
