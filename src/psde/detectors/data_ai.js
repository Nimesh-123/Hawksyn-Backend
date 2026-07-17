/**
 * Data Science & AI Intelligence Detectors
 */

function detectAIResearcher(cv, stats) {
    const keywords = [
        'machine learning', 'deep learning', 'neural networks', 'nlp',
        'natural language processing', 'llm', 'large language models',
        'arxiv', 'research papers', 'published', 'transformer'
    ];
    const text = JSON.stringify(cv).toLowerCase();
    const matches = keywords.filter(k => text.includes(k));
    
    const isDetected = matches.length >= 3;
    
    return {
        detected: isDetected,
        confidence: isDetected ? 0.50 : 0,
        reasoning: isDetected ? 'Demonstrated expertise in AI research, deep learning, and advanced model architectures.' : 'No significant AI researcher signals detected.',
        anchors: []
    };
}

function detectMLEngineer(cv, stats) {
    const keywords = [
        'mlops', 'model deployment', 'tensorflow', 'pytorch',
        'scikit-learn', 'model training', 'inference', 'keras',
        'ml pipeline', 'sagemaker'
    ];
    const text = JSON.stringify(cv).toLowerCase();
    const matches = keywords.filter(k => text.includes(k));
    
    const isDetected = matches.length >= 3;
    
    return {
        detected: isDetected,
        confidence: isDetected ? 0.50 : 0,
        reasoning: isDetected ? 'Proven track record in building, training, and deploying machine learning models at scale.' : 'Limited evidence of ML engineering expertise.',
        anchors: []
    };
}

function detectDataStoryteller(cv, stats) {
    const keywords = [
        'data visualization', 'tableau', 'power bi', 'insights',
        'storytelling with data', 'dashboards', 'looker', 'superset',
        'executive reporting', 'data narrative'
    ];
    const text = JSON.stringify(cv).toLowerCase();
    const matches = keywords.filter(k => text.includes(k));
    
    const isDetected = matches.length >= 2;
    
    return {
        detected: isDetected,
        confidence: isDetected ? 0.50 : 0,
        reasoning: isDetected ? 'Skilled in translating complex data into practical business insights and visual narratives.' : 'No significant data storyteller signals found.',
        anchors: []
    };
}

function detectBigDataArchitect(cv, stats) {
    const keywords = [
        'hadoop', 'spark', 'kafka', 'data lake', 'data warehouse',
        'etl', 'big data', 'snowflake', 'databricks', 'distributed systems',
        'data engineering'
    ];
    const text = JSON.stringify(cv).toLowerCase();
    const matches = keywords.filter(k => text.includes(k));
    
    const isDetected = matches.length >= 2;
    
    return {
        detected: isDetected,
        confidence: isDetected ? 0.50 : 0,
        reasoning: isDetected ? 'Expertise in architecting large-scale data infrastructures and distributed processing systems.' : 'Limited evidence of big data architectural leadership.',
        anchors: []
    };
}

function detectAnalyticsLead(cv, stats) {
    const keywords = [
        'advanced analytics', 'predictive modeling', 'statistical analysis',
        'business intelligence', 'bi', 'regression', 'clustering',
        'hypothesis testing', 'analytics strategy'
    ];
    const text = JSON.stringify(cv).toLowerCase();
    const matches = keywords.filter(k => text.includes(k));
    
    const isDetected = matches.length >= 2;
    
    return {
        detected: isDetected,
        confidence: isDetected ? 0.50 : 0,
        reasoning: isDetected ? 'Strong experience in leading analytics initiatives and leading decisions through statistical rigor.' : 'No significant analytics lead signals detected.',
        anchors: []
    };
}

module.exports = {
    detectAIResearcher,
    detectMLEngineer,
    detectDataStoryteller,
    detectBigDataArchitect,
    detectAnalyticsLead
};
