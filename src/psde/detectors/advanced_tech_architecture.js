/**
 * Advanced Tech Architecture Detectors (Batch 26)
 */

function detectAIMLInfrastructure(cv, stats) {
    const keywords = [
        'llm infrastructure', 'gpu orchestration', 'cuda', 'vector database',
        'pinecone', 'milvus', 'weaviate', 'langchain', 'llama-index',
        'model deployment', 'mlops', 'gpu scaling'
    ];
    const text = JSON.stringify(cv).toLowerCase();
    const isDetected = keywords.some(k => text.includes(k));

    return {
        detected: isDetected,
        confidence: isDetected ? 0.50 : 0,
        reasoning: isDetected ? 'Specialized expertise in the infrastructure and orchestration layers of AI and Machine Learning systems.' : 'No significant AI/ML infrastructure signals detected.',
        anchors: []
    };
}

function detectMicroservicesGuru(cv, stats) {
    const keywords = [
        'service mesh', 'istio', 'linkerd', 'distributed tracing', 'jaeger',
        'prometheus', 'grafana', 'circuit breaker', 'event-driven architecture',
        'kafka', 'rabbitmq', 'microservices pattern', 'domain driven design'
    ];
    const text = JSON.stringify(cv).toLowerCase();
    const hasMesh = text.includes('istio') || text.includes('linkerd') || text.includes('service mesh');
    const hasMessaging = text.includes('kafka') || text.includes('event-driven');
    const isDetected = hasMesh && hasMessaging;

    return {
        detected: isDetected,
        confidence: isDetected ? 0.50 : 0,
        reasoning: isDetected ? 'Advanced mastery of distributed systems, service mesh technologies, and event-driven microservices architecture.' : 'Limited evidence of advanced microservices patterns.',
        anchors: []
    };
}

function detectServerlessEvangelist(cv, stats) {
    const keywords = [
        'serverless', 'aws lambda', 'google cloud functions', 'azure functions',
        'eventbridge', 'step functions', 'fargate', 'cold start optimization',
        'serverless framework', 'sst'
    ];
    const text = JSON.stringify(cv).toLowerCase();
    
    // Higher bar: must mention specific serverless orchestration tools
    const hasFunction = /\blambda\b/i.test(text) || text.includes('functions');
    const hasOrchestration = text.includes('step functions') || text.includes('eventbridge') || text.includes('fargate');
    const isDetected = hasFunction && hasOrchestration;

    return {
        detected: isDetected,
        confidence: isDetected ? 0.50 : 0,
        reasoning: isDetected ? 'Demonstrated expertise in architecting and scaling serverless-first applications with complex orchestration.' : 'No significant serverless-first signals found.',
        anchors: []
    };
}

function detectEdgeComputingSpecialist(cv, stats) {
    const keywords = [
        'edge computing', 'cloudflare workers', 'lambda@edge', 'akamai edge',
        'fastly', 'wasm', 'webassembly', 'edge database', 'cdn strategy',
        'low latency global'
    ];
    const text = JSON.stringify(cv).toLowerCase();
    const isDetected = keywords.some(k => text.includes(k));

    return {
        detected: isDetected,
        confidence: isDetected ? 0.50 : 0,
        reasoning: isDetected ? 'Specializes in edge-side computation and global delivery strategies to minimize latency.' : 'No edge computing signals detected.',
        anchors: []
    };
}

function detectHighConcurrencyArchitect(cv, stats) {
    const keywords = [
        'high concurrency', 'distributed locks', 'raft', 'paxos', 'consensus',
        'sharding', 'horizontal scaling', 'throughput optimization', 'million rps',
        'low-level optimization'
    ];
    const text = JSON.stringify(cv).toLowerCase();
    const isDetected = keywords.some(k => text.includes(k));

    return {
        detected: isDetected,
        confidence: isDetected ? 0.50 : 0,
        reasoning: isDetected ? 'Expertise in high-throughput, concurrent systems and distributed consistency algorithms.' : 'No high-concurrency architecture signals found.',
        anchors: []
    };
}

module.exports = {
    detectAIMLInfrastructure,
    detectMicroservicesGuru,
    detectServerlessEvangelist,
    detectEdgeComputingSpecialist,
    detectHighConcurrencyArchitect
};
