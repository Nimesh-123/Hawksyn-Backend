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
    const findDeepValue = (obj, key) => {
        if (!obj || typeof obj !== 'object') return null;
        if (obj[key] !== undefined) return obj[key];
        for (const k in obj) {
            const val = findDeepValue(obj[k], key);
            if (val !== undefined && val !== null) return val;
        }
        return null;
    };

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

    const rawSkills = findDeepValue(profileSnapshot, 'skills') || {};
    let skillsList = [];
    if (Array.isArray(rawSkills)) {
        skillsList = rawSkills;
    } else if (typeof rawSkills === 'object') {
        const technical = findDeepValue(rawSkills, 'technical') || [];
        const soft = findDeepValue(rawSkills, 'soft') || [];
        const combined = [...(Array.isArray(technical) ? technical : []), ...(Array.isArray(soft) ? soft : [])];
        if (combined.length > 0) skillsList = combined;
        else skillsList = Object.values(rawSkills).filter(v => typeof v === 'string'); // Fallback to all string values
    }
    const skills = skillsList.length > 0 ? skillsList.slice(0, 15).join(', ') : 'Not provided';

    const experienceYears = findDeepValue(profileSnapshot, 'totalExperienceYears')
        || findDeepValue(profileSnapshot, 'totalYearsExperience')
        || 'N/A';

    const currentRole = findDeepValue(profileSnapshot, 'currentRoleTitle')
        || findDeepValue(profileSnapshot, 'title')
        || 'Backend Engineer';

    const currentCompany = findDeepValue(profileSnapshot, 'currentCompany')
        || findDeepValue(profileSnapshot, 'company')
        || 'Not provided';

    const redFlagsSummary = (integrityPack.redFlags?.triggered || [])
        .map(rf => `${rf.redFlagName} (${rf.severityBand})`)
        .join(', ') || 'None';

    const contradictionsSummary = (integrityPack.contradictions?.triggered || [])
        .map(c => c.contradictionName)
        .join(', ') || 'None';

    // --- NEW: Dynamic Signals Mapping ---
    // Handle both { signals: { signals: ... } } and direct { signals: ... } or Array [ { signalId, ... } ]
    const signalsSource = externalSignals?.signals?.signals || externalSignals?.signals || externalSignals || [];
    const signalsArray = Array.isArray(signalsSource) ? signalsSource : Object.entries(signalsSource).map(([k, v]) => ({ ...v, signalId: k }));
    let signalsNarrative = '';

    const baseMap = {
        CURRENT_ROLE:      currentRole,
        CV_ROLE_TITLE:     currentRole,
        EXPERIENCE_YEARS:  String(experienceYears),
        YEARS_IN_DOMAIN:   String(experienceYears),
        SKILLS:            skills,
        CV_SKILLS_CURRENT: skills,
        CURRENT_COMPANY:   currentCompany,
        CV_COMPANY:        currentCompany,
        DOMAIN:            profileSnapshot?.domain || profileSnapshot?.employment?.domain || profileSnapshot?.inferred?.domainIndicator || 'Not provided',
        CV_INDUSTRY:       profileSnapshot?.domain || profileSnapshot?.employment?.domain || profileSnapshot?.inferred?.domainIndicator || 'Not provided',
        ACCURACY_SCORE:    String(integrityPack.accuracy?.score  || 0),
        ACCURACY_BAND:     integrityPack.accuracy?.band           || 'UNKNOWN',
        RED_FLAGS:         redFlagsSummary,
        RED_FLAG_LIST:     redFlagsSummary,
        CONTRADICTIONS:    contradictionsSummary,
        CONTRADICTION_LIST: contradictionsSummary,
        COMPOSITE_SCORE:   String(integrityPack.compositeScore || 0),
        VERDICT:           integrityPack.verdict || 'PAUSE',
        CONFIDENCE:        integrityPack.confidence || 'MEDIUM',
        CONFIDENCE_BAND:   integrityPack.confidence || 'MEDIUM',
        TOTAL_PENALTY:     String(integrityPack.accuracy?.totalPenalty || 0),
        SIGNAL_DATA_QUALITY: externalSignals?.dataQuality || 'INSUFFICIENT',
        ANALYST_NOTE:      externalSignals?.analystNote || 'Insufficient market data for this profile.',
        EXTERNAL_SIGNALS:  '',
        SIGNALS:           '',
        SIGNAL_COUNT:      String(signalsArray.length)
    };

    for (const sig of signalsArray) {
        if (!sig || typeof sig !== 'object') continue;
        const sId = sig.signalId || sig.id;
        if (!sId) continue;

        const val = String(sig.value || sig.score || 'N/A');
        const rat = sig.rationale || sig.citation_text || sig.evidence || 'No evidence provided.';
        const name = sig.name || sig.anchor || sId;

        baseMap[`${sId}_VALUE`] = val;
        baseMap[`${sId}_RATIONALE`] = rat;
        baseMap[`${sId}_CONFIDENCE`] = sig.confidence || sig.confidence_score || 'LOW';
        
        const sanitisedName = name.toUpperCase().replace(/\s+/g, '_');
        baseMap[`SIGNAL_${sanitisedName}_VALUE`] = val;

        // Build a text narrative for {{SIGNALS}} placeholder
        signalsNarrative += `• ${name}: ${val}\n  Rationale: ${rat}\n\n`;
        
        if (sanitisedName.includes('DISPLACEMENT')) {
            baseMap['AI_DISPLACEMENT_RISK'] = val;
            baseMap['AI_DISPLACEMENT_RATIONALE'] = rat;
        }
        if (sanitisedName.includes('HIRING')) {
            baseMap['AUTOMATION_OVERLAP'] = val;
        }
    }

    baseMap.EXTERNAL_SIGNALS = signalsNarrative || 'No external market signals were captured.';
    baseMap.SIGNALS = signalsNarrative || 'No external market signals were captured.';

    // Legacy Question IDs mapping (Only if not already set by smart mapping)
    for (const [qId, label] of Object.entries(answerLabelMap)) {
        if (!baseMap[qId]) {
            baseMap[qId] = label;
        }
    }

    // Debug Log
    console.log(`[Report-Mapper] Finalizing placeholders for ${currentRole}:`, {
        exp: baseMap.EXPERIENCE_YEARS,
        signalsCount: baseMap.SIGNAL_COUNT,
        hasNarrative: !!baseMap.SIGNALS
    });

    return baseMap;
};

/**
 * fillPrompt — Placeholder replacement engine.
 */
const fillPrompt = (template, placeholders) => {
    if (!template || typeof template !== 'string') return 'No prompt template provided.';
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

    const internalResults = integrityPack?.coverage?.results || [];
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
