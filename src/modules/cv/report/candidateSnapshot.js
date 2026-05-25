/**
 * Candidate Snapshot Computation
 * Aggregates raw extracted data and PSDE results into a high-level summary for the report.
 */

function buildCandidateSnapshot(extractedCV, psdeResults) {
  const roles = extractedCV.roles || [];
  const baseAEUs = extractedCV.base_aeus || [];
  const skills = extractedCV.skills?.skills || [];
  const credentials = extractedCV.credentials || [];

  // Career years
  const totalCareerMonths = extractedCV.precomputed_stats?.total_experience_months || 0;

  // Evidence depth
  const totalAEUs = baseAEUs.length;
  const strongAEUs = baseAEUs.filter(a => a.evidence_strength === 'strong').length;
  const ownedAEUs = baseAEUs.filter(a => a.decision_level === 'owned').length;
  const pctStrong = totalAEUs > 0 ? strongAEUs / totalAEUs : 0;
  const pctOwned = totalAEUs > 0 ? ownedAEUs / totalAEUs : 0;

  // Skills gap
  const skillsTotal = skills.length;
  const skillsProven = skills.filter(s => s.appears_in_role_bullets).length;
  const skillsGap = skillsTotal - skillsProven;
  const skillsProvenRatio = skillsTotal > 0 ? skillsProven / skillsTotal : 0;

  // Domain terms
  const allDomainTerms = new Set();
  const domainTermsByRole = {};
  for (const aeu of baseAEUs) {
    const terms = aeu.domain_metadata?.domain_terms_found || [];
    const roleIdx = aeu.role_index;
    for (const term of terms) {
      allDomainTerms.add(term);
      if (!domainTermsByRole[term]) domainTermsByRole[term] = new Set();
      domainTermsByRole[term].add(roleIdx);
    }
  }
  const domainMentioned = allDomainTerms.size;
  const domainConfirmed = Object.values(domainTermsByRole).filter(s => s.size >= 2).length;
  const domainConfirmationRatio = domainMentioned > 0 ? domainConfirmed / domainMentioned : 0;

  // Primary domain
  const domainCounts = {};
  for (const role of roles) {
    const industry = role.domain_metadata?.primary_industry || 'general';
    domainCounts[industry] = (domainCounts[industry] || 0) + 1;
  }
  const primaryDomain = Object.entries(domainCounts)
    .sort((a, b) => b[1] - a[1])[0]?.[0] || 'general';

  // C1 arc type from psde_results
  const c1Arc = psdeResults.archetype_results?.find(a =>
    a.cluster_id === 'C1' && a.detection_state === 'detected'
  );
  // Default to FRAGMENTED if not found
  const c1ArcType = c1Arc?.id === 'ARCH_001_001' ? 'STRONG_UPWARD' 
                  : c1Arc?.id === 'ARCH_001_006' ? 'SLOW_START'
                  : c1Arc?.id === 'ARCH_001_004' ? 'STAGNANT'
                  : 'FRAGMENTED';

  // Signal strength
  const totalDetected = psdeResults.total_detected || 0;
  const totalAEUResults = psdeResults.archetype_results || [];
  const negativeAEUs = totalAEUResults.filter(
    a => a.detection_state === 'detected' && a.polarity === 'negative'
  ).length;
  const flagRatio = totalDetected > 0 ? negativeAEUs / totalDetected : 0;

  let overallSignalStrength;
  if (totalDetected >= 15 && flagRatio <= 0.25) overallSignalStrength = 'Strong';
  else if (totalDetected >= 8 && flagRatio <= 0.40) overallSignalStrength = 'Moderate';
  else if (totalDetected >= 3 && flagRatio <= 0.60) overallSignalStrength = 'Thin';
  else overallSignalStrength = 'Insufficient';
  
  // Strongest clusters
  const clusterMap = {
    'C1': 'Trajectory & Growth',
    'C2': 'Tenure & Stability',
    'C3': 'Scope & Ownership',
    'C4': 'Impact & Output',
    'C5': 'Skills & Learning',
    'C6': 'Identity & Intent',
    'C7': 'Domain & Exposure',
    'C8': 'Visibility & Network'
  };
  const clusterCounts = {};
  for (const arch of totalAEUResults) {
    if (['detected', 'partial'].includes(arch.detection_state)) {
      const cName = clusterMap[arch.cluster_id] || arch.cluster_id;
      clusterCounts[cName] = (clusterCounts[cName] || 0) + 1;
    }
  }
  const sortedClusters = Object.entries(clusterCounts).sort((a, b) => b[1] - a[1]);
  const strongestCluster = sortedClusters[0]?.[0] || 'Domain Depth';
  const secondStrongestCluster = sortedClusters[1]?.[0] || 'Scope';

  // Seniority transitions
  const seniorityTransitions = roles.reduce((count, role, i) => {
    if (i === 0) return count;
    const prev = roles[i-1].role_metadata?.title_seniority_rank || 0;
    const curr = role.role_metadata?.title_seniority_rank || 0;
    return prev !== curr ? count + 1 : count;
  }, 0);

  // Distinct companies and locations
  const distinctCompanies = new Set(roles.map(r => r.role_metadata?.company_canonical)).size;
  const distinctLocations = new Set(roles.map(r => r.role_metadata?.location).filter(Boolean)).size;

  // Gap periods
  const gapPeriods = [];
  for (let i = 0; i < roles.length - 1; i++) {
    const end = roles[i].role_metadata?.end_date;
    const start = roles[i+1]?.role_metadata?.start_date;
    if (end && start && end !== 'Present') {
      const gapMonths = monthDiff(end, start);
      if (gapMonths > 1) gapPeriods.push({ between: i, months: gapMonths });
    }
  }

  return {
    total_career_months: totalCareerMonths,
    role_count: roles.length,
    total_aeus: totalAEUs,
    skills_total: skillsTotal,
    skills_proven: skillsProven,
    skills_gap: skillsGap,
    skills_proven_ratio: skillsProvenRatio,
    pct_strong: pctStrong,
    pct_owned: pctOwned,
    domain_mentioned: domainMentioned,
    domain_confirmed: domainConfirmed,
    domain_confirmation_ratio: domainConfirmationRatio,
    primary_domain: primaryDomain,
    overall_signal_strength: overallSignalStrength,
    c1_arc_type: c1ArcType,
    flag_ratio: flagRatio,
    seniority_transitions: seniorityTransitions,
    distinct_companies: distinctCompanies,
    distinct_locations: distinctLocations,
    gap_periods: gapPeriods,
    credentials_count: credentials.length,
    strongest_cluster: strongestCluster,
    second_strongest_cluster: secondStrongestCluster
  };
}

function monthDiff(dateStr1, dateStr2) {
  try {
    // Parse YYYY-MM format
    const [y1, m1] = dateStr1.split('-').map(Number);
    const [y2, m2] = dateStr2.split('-').map(Number);
    if (isNaN(y1) || isNaN(y2)) return 0;
    return (y2 - y1) * 12 + (m2 - m1);
  } catch (e) {
    return 0;
  }
}

module.exports = { buildCandidateSnapshot };
