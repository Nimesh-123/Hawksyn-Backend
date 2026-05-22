/**
 * HealthTech & Biotech Detectors (Batch 32)
 */

function detectClinicalOperationsDirector(cv, stats) {
    const keywords = [
        'clinical operations', 'clinical trial management', 'gcp compliance',
        'cro management', 'patient recruitment', 'clinical data management',
        'trial site selection', 'clinical protocol'
    ];
    const text = JSON.stringify(cv).toLowerCase();
    const isDetected = keywords.some(k => text.includes(k));

    return {
        detected: isDetected,
        confidence: isDetected ? 0.96 : 0,
        reasoning: isDetected ? 'Proven expertise in managing the operational lifecycle of clinical trials and ensuring strict GCP compliance.' : 'No significant clinical operations signals detected.',
        anchors: []
    };
}

function detectHealthInformaticsLead(cv, stats) {
    const keywords = [
        'health informatics', 'ehr integration', 'emr integration', 'hl7',
        'fhir', 'healthcare interoperability', 'loinc', 'snomed',
        'healthcare data standards'
    ];
    const text = JSON.stringify(cv).toLowerCase();
    const isDetected = keywords.some(k => text.includes(k));

    return {
        detected: isDetected,
        confidence: isDetected ? 0.95 : 0,
        reasoning: isDetected ? 'Specializes in healthcare data standards and the integration of electronic health records (EHR) into clinical workflows.' : 'No significant health informatics signals found.',
        anchors: []
    };
}

function detectMedicalAffairsStrategist(cv, stats) {
    const keywords = [
        'medical affairs', 'kol engagement', 'medical storytelling', 'scientific communication',
        'msl management', 'medical publications', 'evidence-based medicine',
        'medical marketing'
    ];
    const text = JSON.stringify(cv).toLowerCase();
    const isDetected = keywords.some(k => text.includes(k));

    return {
        detected: isDetected,
        confidence: isDetected ? 0.94 : 0,
        reasoning: isDetected ? 'Proven ability to bridge scientific data and commercial strategy through medical affairs and key opinion leader (KOL) engagement.' : 'Limited evidence of medical affairs leadership.',
        anchors: []
    };
}

function detectBioprocessEngineer(cv, stats) {
    const keywords = [
        'bioprocess engineering', 'fermentation', 'downstream processing',
        'upstream processing', 'bioreactor', 'biotech scale-up',
        'cgmp manufacturing', 'purification process'
    ];
    const text = JSON.stringify(cv).toLowerCase();
    const isDetected = keywords.some(k => text.includes(k));

    return {
        detected: isDetected,
        confidence: isDetected ? 0.93 : 0,
        reasoning: isDetected ? 'Specializes in the technical scaling and manufacturing of biotechnological products and processes.' : 'No significant bioprocess engineering signals found.',
        anchors: []
    };
}

function detectPatientAdvocacyLead(cv, stats) {
    const keywords = [
        'patient advocacy', 'patient group engagement', 'patient experience',
        'caregiver engagement', 'patient centered care', 'patient voice'
    ];
    const text = JSON.stringify(cv).toLowerCase();
    const isDetected = keywords.some(k => text.includes(k));

    return {
        detected: isDetected,
        confidence: isDetected ? 0.92 : 0,
        reasoning: isDetected ? 'Experienced in managing relationships with patient groups and ensuring the patient voice is central to clinical and commercial strategy.' : 'Limited evidence of patient advocacy leadership.',
        anchors: []
    };
}

module.exports = {
    detectClinicalOperationsDirector,
    detectHealthInformaticsLead,
    detectMedicalAffairsStrategist,
    detectBioprocessEngineer,
    detectPatientAdvocacyLead
};
