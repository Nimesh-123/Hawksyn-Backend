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

    // ─── FIX 5: UNKNOWN Field Elimination Audit ─────────────────────────────
    const logUnknownAudit = (field, sourcePath, resolved, value) => {
        if (resolved && value && String(value).toUpperCase() !== 'UNKNOWN' && String(value).toUpperCase() !== 'NOT PROVIDED' && String(value).toUpperCase() !== 'N/A' && String(value).trim() !== '') {
            console.log(`[UNKNOWN-AUDIT]\nfield=${field}\nsourcePath=${sourcePath}\nresolved=true\nvalue=${value}`);
        } else {
            console.log(`[UNKNOWN-AUDIT]\nfield=${field}\nsourcePath=${sourcePath}\nresolved=false`);
        }
    };

    const answerLabelMap = {};
    for (const ans of (rasAnswers || [])) {
        const { answerValue, answerLabel, questionId } = ans;
        if (!questionId) continue;
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

    let rawExp = findDeepValue(profileSnapshot, 'totalExperienceYears') || findDeepValue(profileSnapshot, 'totalYearsExperience');
    logUnknownAudit('EXPERIENCE_YEARS', 'profileSnapshot.totalExperienceYears | totalYearsExperience', !!rawExp, rawExp);
    const experienceYears = rawExp || 'N/A';

    let currentRecord = null;
    const expArray = findDeepValue(profileSnapshot, 'experience') || findDeepValue(profileSnapshot, 'history') || [];
    if (Array.isArray(expArray) && expArray.length > 0) {
        currentRecord = expArray.find(r => r.isCurrent === true || r.is_current === true || (r.duration && r.duration.toLowerCase().includes('present')));
        if (!currentRecord) currentRecord = expArray[expArray.length - 1];
    }

    let rawRole = profileSnapshot?.identity?.currentRoleTitle || profileSnapshot?.currentRoleTitle || currentRecord?.title || currentRecord?.role;
    logUnknownAudit('CURRENT_ROLE', 'identity.currentRoleTitle | currentRecord.title', !!rawRole, rawRole);
    const currentRole = rawRole || 'Backend Engineer';

    let rawCompany = profileSnapshot?.identity?.currentCompany || profileSnapshot?.currentCompany || currentRecord?.company || currentRecord?.employer;
    logUnknownAudit('CURRENT_COMPANY', 'identity.currentCompany | currentRecord.company', !!rawCompany, rawCompany);
    const currentCompany = rawCompany || 'Not provided';

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

    // ─── FIX 2: Expanded domain/industry detection ─────────────────────────────
    // Search all known CV parser output paths for domain/industry
    const DOMAIN_INVALID = new Set(['UNKNOWN', 'NOT PROVIDED', 'N/A', 'NULL', 'UNDEFINED', '']);
    const isDomainValid = (v) => v && typeof v === 'string' && !DOMAIN_INVALID.has(v.trim().toUpperCase());

    let rawDomain = null;
    const domainCandidates = [
        profileSnapshot?.domain,
        profileSnapshot?.industry,
        profileSnapshot?.currentIndustry,
        profileSnapshot?.sector,
        profileSnapshot?.employment?.domain,
        profileSnapshot?.employment?.industry,
        profileSnapshot?.employment?.sector,
        profileSnapshot?.work?.domain,
        profileSnapshot?.work?.industry,
        profileSnapshot?.inferred?.domainIndicator,
        profileSnapshot?.inferred?.industry,
        profileSnapshot?.inferred?.domain,
        profileSnapshot?.personalInfo?.industry,
        profileSnapshot?.personalInfo?.domain,
        profileSnapshot?.seniority?.industry,
        profileSnapshot?.seniority?.domain,
        profileSnapshot?.identity?.industry,
        profileSnapshot?.identity?.domain,
        findDeepValue(profileSnapshot, 'domain'),
        findDeepValue(profileSnapshot, 'industry'),
        findDeepValue(profileSnapshot, 'sector'),
        findDeepValue(profileSnapshot, 'vertical'),
        findDeepValue(profileSnapshot, 'field'),
    ];
    for (const candidate of domainCandidates) {
        if (isDomainValid(candidate)) {
            rawDomain = String(candidate).trim();
            break;
        }
    }
    logUnknownAudit('DOMAIN', 'domainCandidates[]', !!rawDomain, rawDomain);
    const finalDomain = rawDomain || 'Software Engineering';
    console.log(`[Report-Mapper] Domain resolution: found="${rawDomain}" → final="${finalDomain}"`);


    const accScore = integrityPack.accuracy?.score || 0;
    let accBand = integrityPack.accuracy?.band;
    if (!accBand || String(accBand).toUpperCase() === 'UNKNOWN') {
        if (accScore >= 80) accBand = 'FULL';
        else if (accScore >= 50) accBand = 'MEDIUM';
        else accBand = 'LOW';
    }

    const baseMap = {
        CANDIDATE_NAME: findDeepValue(profileSnapshot, 'fullName') || findDeepValue(profileSnapshot, 'name') || 'Candidate',
        CONFIRMED_PROFILE: JSON.stringify(profileSnapshot),
        CV_AEUS: JSON.stringify(profileSnapshot),
        CURRENT_ROLE: currentRole,
        CV_ROLE_TITLE: currentRole,
        EXPERIENCE_YEARS: String(experienceYears),
        YEARS_IN_DOMAIN: String(experienceYears),
        SKILLS: skills,
        CV_SKILLS_CURRENT: skills,
        CURRENT_COMPANY: currentCompany,
        CV_COMPANY: currentCompany,
        DOMAIN: finalDomain,
        CV_INDUSTRY: finalDomain,
        ACCURACY_SCORE: String(accScore),
        ACCURACY_BAND: accBand,
        RED_FLAGS: redFlagsSummary,
        RED_FLAG_LIST: redFlagsSummary,
        CONTRADICTIONS: contradictionsSummary,
        CONTRADICTION_LIST: contradictionsSummary,
        COMPOSITE_SCORE: String(integrityPack.compositeScore || 0),
        VERDICT: integrityPack.verdict || 'PAUSE',
        CONFIDENCE: integrityPack.confidence || 'MEDIUM',
        CONFIDENCE_BAND: integrityPack.confidence || 'MEDIUM',
        TOTAL_PENALTY: String(integrityPack.accuracy?.totalPenalty || 0),
        SIGNAL_DATA_QUALITY: externalSignals?.dataQuality || 'INSUFFICIENT',
        ANALYST_NOTE: externalSignals?.analystNote || 'Insufficient market data for this profile.',
        EXTERNAL_SIGNALS: '',
        SIGNALS: '',
        SIGNAL_COUNT: String(signalsArray.length),
        
        // --- FIX FOR UNKNOWN FIELDS ---
        INDUSTRY: finalDomain,
        COVERAGE_ANCHOR_STATUS: (integrityPack?.coverage?.allCovered !== false) ? 'Complete' : 'Partial',
        INTENT_HORIZON: '180 Days' // Default fallback, typically 180 or 365 days
    };

    // Add Constraint Scores
    const constraintResults = integrityPack.constraints?.results || [];
    const constraintScores = {};
    for (const c of constraintResults) {
        const match = c.constraintId.match(/_00(\d)$/);
        if (match) {
            const cNum = match[1];
            constraintScores[`C${cNum}`] = c.score;
            baseMap[`C${cNum}_SCORE`] = String(c.score);
            baseMap[`C${cNum}_STATUS`] = c.band;
        }
    }
    
    const hasMCQ = Object.keys(answerLabelMap).length > 0;
    if (!hasMCQ || constraintResults.length === 0) {
        baseMap.CONSTRAINT_SCORES_ALL = 'UNKNOWN (MCQ Data Missing)';
    } else {
        baseMap.CONSTRAINT_SCORES_ALL = JSON.stringify(constraintScores);
    }
    
    const recheckDate = new Date();
    recheckDate.setDate(recheckDate.getDate() + 30);
    const dd = String(recheckDate.getDate()).padStart(2, '0');
    const mm = String(recheckDate.getMonth() + 1).padStart(2, '0');
    const yyyy = recheckDate.getFullYear();
    baseMap.RECHECK_DATE = `${dd}-${mm}-${yyyy}`;

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

    // Populate Q1_ANSWER to Q10_ANSWER
    for (let i = 1; i <= 10; i++) {
        const qId = `Q_RO_${String(i).padStart(3, '0')}`;
        baseMap[`Q${i}_ANSWER`] = getAnswerText(rasAnswers, qId, questionsMap);
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
    
    const CANONICAL_INTERNAL_MAP = {
        'CV_SKILLS_CURRENT': 'Top Skills',
        'CV_INDUSTRY': 'Industry',
        'CV_ROLE_TITLE': 'Current Role Title',
        'CV_COMPANY': 'Current Company Name',
        'YEARS_IN_DOMAIN': 'Total Years of Experience',
        'CV_EXPERIENCE_YEARS': 'Total Years of Experience',
        'CV_ROLE_TYPE': 'Current Role Title'
    };

    const missingInternal = internalAnchors.filter(anchor => {
        // Only validate CV anchors that have a canonical mapping
        if (!CANONICAL_INTERNAL_MAP[anchor]) return false;
        
        const mappedAnchor = CANONICAL_INTERNAL_MAP[anchor];
        const result = internalResults.find(c => c.anchor === mappedAnchor || c.anchorName === mappedAnchor || c.anchor === anchor);
        return !result || result.sufficiency === 'NOT_FOUND';
    });

    const EXTERNAL_SIGNAL_MAP = {
        'Labour Market Risk Anchor': 'EST_LM_001',
        'Industry Stability Anchor': 'EST_IND_002',
        'Company Stability Anchor': 'EST_CO_003',
        'AI Skill Demand Anchor': 'EST_TECH_004',
        'Regulatory Compliance Anchor': 'EST_REG_005'
    };

    const missingExternal = externalAnchors.filter(anchor => {
        const expectedSignalId = EXTERNAL_SIGNAL_MAP[anchor];
        const result = (externalCoverage || []).find(c => c.signalId === expectedSignalId || c.anchor === anchor);
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
            .replace(/\bdefinitely\b/gi, 'likely')
            .replace(/\bcertainly\b/gi, 'probably')
            .replace(/\bwill definitely\b/gi, 'may')
            .replace(/\bguaranteed\b/gi, 'expected')
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
    if (upper.includes('ABORT')) return 'ABORT';
    if (upper.includes('PROCEED')) return 'PROCEED';
    if (upper.includes('PAUSE')) return 'PAUSE';
    return 'PAUSE';
};

function getAnswerText(rasAnswers, questionId, questionsMap) {
    const answer = rasAnswers.find(a => a.questionId === questionId);
    if (!answer) return 'Not answered';

    // New JSON structure support
    if (answer.answerLabel) return answer.answerLabel;
    if (answer.answerValue) return answer.answerValue;
    if (answer.answerText) return answer.answerText;

    // Legacy format fallback
    const q = questionsMap[questionId];
    if (!q) return 'Not answered';
    const optionMap = { a: q?.option_a, b: q?.option_b, c: q?.option_c, d: q?.option_d };
    return optionMap[answer.selectedOption?.toLowerCase()] || 'Not answered';
}

function getConstraintBand(score) {
    if (score >= 80) return 'STRONG';
    if (score >= 60) return 'MODERATE';
    if (score >= 40) return 'FRAGILE';
    return 'CRITICAL';
}

function formatSignal(signalsRas, signalId) {
    const signal = signalsRas?.artifactJson?.signals?.signals?.[signalId] 
                || signalsRas?.artifactJson?.signals?.[signalId];
    if (!signal) return 'Signal not collected';
    return {
        value: signal.index_value || signal.value || 'Unknown',
        confidence: signal.confidence || 'Unknown',
        summary: signal.rationale || signal.summary || 'No summary available'
    };
}

module.exports = {
    anonymizeReport,
    getDeepValue,
    buildPlaceholderMap,
    fillPrompt,
    checkAnchors,
    applyCertaintyCap,
    extractVerdict,
    getAnswerText,
    getConstraintBand,
    formatSignal,

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
