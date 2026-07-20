/**
 * Customer Success & Experience Detectors
 */

function detectRetentionMaster(cv, stats) {
    const keywords = [
        'churn', 'retention strategy', 'customer health score',
        'renewal rate', 'gross retention', 'net retention',
        'retention programs', 'prevented churn'
    ];
    const text = JSON.stringify(cv).toLowerCase();
    const matches = keywords.filter(k => text.includes(k));
    
    const isDetected = matches.length >= 1;
    
    return {
        detected: isDetected,
        confidence: isDetected ? 0.50 : 0,
        reasoning: isDetected ? 'Proven track record in reducing churn and leading long-term customer retention.' : 'No significant retention master signals detected.',
        anchors: []
    };
}

function detectCXArchitect(cv, stats) {
    const keywords = [
        'customer experience', 'cx strategy', 'customer journey',
        'cx transformation', 'omnichannel experience', 'customer sentiment',
        'cx design', 'end-to-end experience', 'user journey'
    ];
    const text = JSON.stringify(cv).toLowerCase();
    const matches = keywords.filter(k => text.includes(k));
    
    const isDetected = matches.length >= 1;
    
    return {
        detected: isDetected,
        confidence: isDetected ? 0.50 : 0,
        reasoning: isDetected ? 'high-level thinker focused on designing and transforming the end-to-end customer experience.' : 'Limited evidence of CX architectural leadership.',
        anchors: []
    };
}

function detectCustomerAdvocate(cv, stats) {
    const keywords = [
        'nps improvement', 'csat', 'customer advocacy', 'voice of customer',
        'voc', 'customer obsession', 'customer-centricity', 'user feedback loop'
    ];
    const text = JSON.stringify(cv).toLowerCase();
    const matches = keywords.filter(k => text.includes(k));
    
    const isDetected = matches.length >= 2;
    
    return {
        detected: isDetected,
        confidence: isDetected ? 0.50 : 0,
        reasoning: isDetected ? 'Acts as a strong internal advocate for the customer, leveraging feedback to lead improvements.' : 'No significant customer advocacy signals found.',
        anchors: []
    };
}

function detectOnboardingSpecialist(cv, stats) {
    const keywords = [
        'customer onboarding', 'time-to-value', 'ttv', 'client implementation',
        'software rollout', 'customer activation', 'onboarding framework',
        'user adoption'
    ];
    const text = JSON.stringify(cv).toLowerCase();
    const matches = keywords.filter(k => text.includes(k));
    
    const isDetected = matches.length >= 2;
    
    return {
        detected: isDetected,
        confidence: isDetected ? 0.50 : 0,
        reasoning: isDetected ? 'Expert in accelerating customer time-to-value through efficient onboarding and implementation.' : 'Limited evidence of specialized onboarding expertise.',
        anchors: []
    };
}

function detectScaleCSM(cv, stats) {
    const keywords = [
        'scaled customer success', 'digital touch', 'tech-touch', 
        'cs automation', 'high-volume accounts', 'one-to-many',
        'cs operations', 'automated renewals'
    ];
    const text = JSON.stringify(cv).toLowerCase();
    const matches = keywords.filter(k => text.includes(k));
    
    const isDetected = matches.length >= 2;
    
    return {
        detected: isDetected,
        confidence: isDetected ? 0.50 : 0,
        reasoning: isDetected ? 'Experienced in managing large account volumes through automated and digital-first customer success models.' : 'No significant Scale CSM signals detected.',
        anchors: []
    };
}

module.exports = {
    detectRetentionMaster,
    detectCXArchitect,
    detectCustomerAdvocate,
    detectOnboardingSpecialist,
    detectScaleCSM
};
