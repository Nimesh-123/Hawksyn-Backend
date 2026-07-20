/**
 * Engineering Culture & DevOps DNA Detectors
 */

function detectDevOpsPioneer(cv, stats) {
    const keywords = [
        'ci/cd', 'continuous integration', 'continuous delivery', 
        'terraform', 'infrastructure as code', 'iac', 'kubernetes', 'k8s',
        'docker', 'jenkins', 'github actions', 'ansible', 'chef', 'puppet'
    ];
    const text = JSON.stringify(cv).toLowerCase();
    const matches = keywords.filter(k => text.includes(k));
    
    const isDetected = matches.length >= 3;
    
    return {
        detected: isDetected,
        confidence: isDetected ? 0.50 : 0,
        reasoning: isDetected ? 'Demonstrated leadership in automation, CI/CD, and Infrastructure-as-Code (IaC) practices.' : 'No significant DevOps pioneer signals detected.',
        anchors: []
    };
}

function detectCloudNativeArchitect(cv, stats) {
    const keywords = [
        'microservices', 'serverless', 'lambda', 'distributed systems',
        'event-driven', 'aws', 'azure', 'gcp', 'cloud-native', 
        'high availability', 'scalability', 'auto-scaling'
    ];
    const text = JSON.stringify(cv).toLowerCase();
    const matches = keywords.filter(k => text.includes(k));
    
    const isDetected = matches.length >= 3;
    
    return {
        detected: isDetected,
        confidence: isDetected ? 0.50 : 0,
        reasoning: isDetected ? 'Expertise in designing and scaling cloud-native architectures and distributed systems.' : 'Limited evidence of cloud-native architectural patterns.',
        anchors: []
    };
}

function detectSecurityFirstDeveloper(cv, stats) {
    const keywords = [
        'owasp', 'penetration testing', 'vulnerability', 'encryption',
        'oauth', 'saml', 'identity management', 'soc2', 'iso 27001',
        'gdpr compliance', 'secure coding', 'application security'
    ];
    const text = JSON.stringify(cv).toLowerCase();
    const matches = keywords.filter(k => text.includes(k));
    
    const isDetected = matches.length >= 2;
    
    return {
        detected: isDetected,
        confidence: isDetected ? 0.50 : 0,
        reasoning: isDetected ? 'Strong focus on security-first development practices and compliance standards.' : 'No significant security-first signals detected.',
        anchors: []
    };
}

function detectLegacyModernizer(cv, stats) {
    const keywords = [
        'modernization', 'monolith to microservices', 'refactoring', 
        'legacy system', 'migration', 'strangler pattern', 'technical debt',
        'mainframe migration', 're-platforming'
    ];
    const text = JSON.stringify(cv).toLowerCase();
    const matches = keywords.filter(k => text.includes(k));
    
    const isDetected = matches.length >= 2;
    
    return {
        detected: isDetected,
        confidence: isDetected ? 0.50 : 0,
        reasoning: isDetected ? 'Proven experience in migrating complex legacy systems to modern, scalable architectures.' : 'Limited legacy modernization evidence found.',
        anchors: []
    };
}

function detectDataDrivenEngineer(cv, stats) {
    const keywords = [
        'a/b testing', 'observability', 'prometheus', 'grafana', 
        'datadog', 'sre', 'error budget', 'sli', 'slo', 'metrics-driven',
        'performance tuning', 'latency optimization'
    ];
    const text = JSON.stringify(cv).toLowerCase();
    const matches = keywords.filter(k => text.includes(k));
    
    const isDetected = matches.length >= 2;
    
    return {
        detected: isDetected,
        confidence: isDetected ? 0.50 : 0,
        reasoning: isDetected ? 'Adopts a metrics-first approach to engineering, focusing on observability and performance.' : 'No data-driven engineering signals detected.',
        anchors: []
    };
}

module.exports = {
    detectDevOpsPioneer,
    detectCloudNativeArchitect,
    detectSecurityFirstDeveloper,
    detectLegacyModernizer,
    detectDataDrivenEngineer
};
