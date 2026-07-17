// Resolves OI-2: Dimension Divider Lookup Table
// Maps archetype prefixes to UI dimension names

const dimensionLookup = {
    'ARCH_001': 'Career Trajectory',
    'ARCH_002': 'Growth Rate',
    'ARCH_003': 'Impact Breadth',
    'ARCH_004': 'Complexity Capacity',
    'ARCH_005': 'Tenure Patterns',
    'ARCH_006': 'Domain Specialization',
    'ARCH_007': 'Adaptability',
    'ARCH_008': 'Leadership Velocity'
};

const getDimensionName = (archetypeId) => {
    if (!archetypeId) return null;
    const prefix = archetypeId.substring(0, 8); // e.g. "ARCH_001"
    return dimensionLookup[prefix] || null;
};

module.exports = {
    dimensionLookup,
    getDimensionName
};

