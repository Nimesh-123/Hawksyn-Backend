const { buildCandidateSnapshot } = require('./candidateSnapshot');

/**
 * FINAL Recruiter Intelligence Report Generator
 * Aggregates all backend intelligence into a single, frontend-ready object.
 */
function generateReport(extractedCV, psdeResult, metrics) {
    const snapshot = buildCandidateSnapshot(extractedCV, psdeResult);
    const roles = extractedCV.roles || [];
    const baseAEUs = extractedCV.base_aeus || [];
    const skills = extractedCV.skills?.skills || [];
    const education = extractedCV.education || [];
    const credentials = extractedCV.credentials || [];
    const allArchetypes = psdeResult.archetype_results || [];

    // Helper: Map cluster names to UI keys (must match ReportDashboardFinal.jsx CLUSTERS keys)
    const { CLUSTER_MAP } = require('../../../psde/registry');

    // --- SECTION 1: HEADER / PROFILE HERO ---
    // Improved logic: Find the "Present" role, or the one with the latest start date
    let currentRoleData = roles[0]?.role_metadata || {};
    if (roles.length > 0) {
        const sortedRoles = [...roles].sort((a, b) => {
            const dateA = a.role_metadata?.start_date ? new Date(a.role_metadata.start_date) : new Date(0);
            const dateB = b.role_metadata?.start_date ? new Date(b.role_metadata.start_date) : new Date(0);
            return dateB - dateA;
        });
        
        // Find if any role is "Present"
        const presentRole = roles.find(r => r.role_metadata?.end_date?.toLowerCase().includes('present'));
        currentRoleData = presentRole ? presentRole.role_metadata : sortedRoles[0]?.role_metadata;
    }

    const header = {
        candidate_name: extractedCV.header?.name || 'Unknown Candidate',
        headline_title: currentRoleData.title || 'Professional',
        location: currentRoleData.location || 'Not Specified',
        experience_years: Math.round(snapshot.total_career_months / 12),
        email: extractedCV.header?.email || '',
        phone: extractedCV.header?.phone || '',
        linkedin_url: extractedCV.header?.linkedin_url || '',
        current_company: currentRoleData.company_canonical || '',
        current_role: currentRoleData.title || '',
        top_domain: snapshot.primary_domain || 'Generalist',
        career_level: getCareerLevel(snapshot.total_career_months)
    };

    // --- SECTION 2: EXECUTIVE INTELLIGENCE SUMMARY ---
    const executiveSummary = {
        candidate_intelligence_summary: psdeResult.candidate_intelligence_summary || 'No summary available.',
        top_strengths: allArchetypes
            .filter(a => a.detection_state === 'detected' && a.polarity === 'positive')
            .sort((a, b) => b.confidence_score - a.confidence_score)
            .slice(0, 4)
            .map(a => a.archetype_name),
        top_risks: allArchetypes
            .filter(a => a.detection_state === 'detected' && a.polarity === 'negative')
            .sort((a, b) => b.confidence_score - a.confidence_score)
            .map(a => a.archetype_name),
        overall_recommendation: getRecommendation(snapshot),
        confidence_level: snapshot.overall_signal_strength || 'Moderate'
    };

    // --- SECTION 3: CLUSTER INTELLIGENCE DASHBOARD ---
    // Mapping our C1-C8 summary to the UI-required cluster labels
    const clusterSummary = {};
    Object.entries(psdeResult.cluster_summary || {}).forEach(([cid, counts]) => {
        const label = CLUSTER_MAP[cid] || cid;
        const total = (counts.detected || 0) + (counts.partial || 0) + (counts.not_detected || 0);
        const score = total > 0 ? ((counts.detected || 0) + (counts.partial || 0) * 0.5) / total : 0;
        clusterSummary[label] = {
            detected: counts.detected || 0,
            partial: counts.partial || 0,
            total_evaluated: total,
            score: parseFloat(score.toFixed(2))
        };
    });

    // --- SECTION 4: TOP ARCHETYPES / SIGNALS ---
    const topSignals = allArchetypes
        .sort((a, b) => {
            if (a.detection_state === 'detected' && b.detection_state !== 'detected') return -1;
            if (a.detection_state !== 'detected' && b.detection_state === 'detected') return 1;
            return b.confidence_score - a.confidence_score;
        })
        .map(a => ({
            archetype_id: a.archetype_id,
            archetype_name: a.archetype_name,
            cluster: CLUSTER_MAP[a.cluster_id] || a.cluster_id,
            confidence_score: a.confidence_score >= 0.7 ? 'High' : (a.confidence_score >= 0.4 ? 'Med' : 'Low'),
            reasoning: a.reasoning,
            polarity: a.polarity,
            evidence_aeu_ids: a.evidence_anchors?.map(anc => anc.anchor_id) || [],
            detection_state: a.detection_state
        }));

    // --- SECTION 5: CAREER TRAJECTORY TIMELINE ---
    const careerTimeline = roles.map((r, idx) => {
        const roleIndexMatch = roles.length - idx;
        const aeusCount = (baseAEUs || []).filter(a => a.role_index === roleIndexMatch || a.role_index === idx || a.role_index === idx + 1).length;

        const startDateStr = r.role_metadata?.start_date;
        const endDateStr = r.role_metadata?.end_date;

        const companyCanonical = r.role_metadata?.company_canonical || r.role_metadata?.company || 'Unknown';
        const isTier1 = r.role_metadata?.is_tier1 || ['ibm', 'ibm global', 'google', 'microsoft', 'amazon', 'aws', 'meta', 'apple', 'netflix'].includes(companyCanonical.toLowerCase().trim());

        return {
            company: companyCanonical,
            title: r.role_metadata?.title || 'Unknown',
            location: r.role_metadata?.location || 'Not Specified',
            start_date: startDateStr || 'Unknown',
            end_date: endDateStr || 'Unknown',
            duration_months: r.role_metadata?.duration_months || 0,
            seniority_score: r.role_metadata?.title_seniority_rank || 0,
            internal_promotion: r.role_metadata?.is_internal_promotion || false,
            tier1_employer: isTier1,
            domain: r.domain_metadata?.primary_industry || (extractedCV.domain_intelligence && extractedCV.domain_intelligence.primary_domains && extractedCV.domain_intelligence.primary_domains[0]) || snapshot.primary_domain || 'general',
            base_aeus_count: aeusCount
        };
    });

    // --- SECTION 6: IMPACT & METRICS ---
    const impactEvidence = baseAEUs
        .filter(a => a.evidence_strength === 'strong' && (a.metrics?.value || a.metrics?.amount_inr))
        .sort((a, b) => (b.complexity_score || 0) - (a.complexity_score || 0))
        .slice(0, 8)
        .map(a => ({
            action: a.action || a.action_verb,
            object: a.object || a.business_object,
            metric_value: a.metrics?.value,
            metric_unit: a.metrics?.metric_name || a.metric_unit,
            currency_code: a.metrics?.currency_code || a.currency_code,
            business_outcome: a.business_outcome,
            decision_level: a.decision_level,
            complexity: a.complexity || a.complexity_level,
            evidence_strength: a.evidence_strength
        }));

    // --- SECTION 7: LEADERSHIP & OWNERSHIP ---
    const leadershipArchetypes = allArchetypes.filter(a => a.cluster_id === 'C3' && ['detected', 'partial'].includes(a.detection_state));
    const leadershipInsights = {
        leadership_signal_count: leadershipArchetypes.length,
        team_size_detected: extractedCV.precomputed_stats?.max_team_size || 0,
        ownership_signals: [...baseAEUs].filter(a => a.decision_level === 'owned').reverse().slice(0, 5),
        executive_responsibilities: leadershipArchetypes.filter(a => a.archetype_id.includes('EXE')).map(a => a.archetype_name),
        governance_signals: leadershipArchetypes.filter(a => a.archetype_id.includes('GOV')).map(a => a.archetype_name)
    };

    // --- SECTION 8: DOMAIN DEPTH & SPECIALIZATION ---
    const skillsDomains = skills
        .filter(s => ['functional', 'technical', 'Domain-Specific'].includes(s.category) && s.appears_in_role_bullets)
        .map(s => s.skill_name);

    const primaryDomainsFallback = extractedCV.employment?.domain 
        ? [extractedCV.employment.domain] 
        : (skillsDomains.length > 0 ? skillsDomains.slice(0, 5) : ["general"]);

    const domainIntelligence = {
        primary_domains: extractedCV.inferred_profile?.industry 
            ? [extractedCV.inferred_profile.industry] 
            : primaryDomainsFallback,
        domain_depth_score: extractedCV.precomputed_stats?.domain_depth_score || (skillsDomains.length > 5 ? 0.8 : 0.4),
        cross_domain_exposure: Array.from(new Set(roles.map(r => r.domain_metadata?.secondary_industry).filter(Boolean))),
        specializations: skillsDomains,
        industry_consistency: snapshot.domain_confirmation_ratio > 0.6 ? 'High' : 'Mixed'
    };

    // --- SECTION 9: RISK INTELLIGENCE ---
    const riskSignals = allArchetypes
        .filter(a => a.cluster_id === 'C6' && a.polarity === 'negative' && ['detected', 'partial'].includes(a.detection_state))
        .map(a => ({
            risk_name: a.archetype_name,
            confidence: a.confidence_score,
            reasoning: a.reasoning,
            severity: 'negative',
            evidence: a.evidence_anchors?.map(anc => anc.anchor_value) || []
        }));

    // --- SECTION 10: EDUCATION & CREDENTIALS ---
    const educationSection = education.map(edu => ({
        institution: edu.institution_canonical || edu.institution,
        degree: edu.degree_canonical || edu.degree_original,
        year_completed: edu.year_completed,
        tier1_institution: edu.institution_tier === 'tier1'
    }));

    // --- SECTION 11: VALIDATION & DATA HEALTH ---
    const validationScore = Math.round((1 - snapshot.flag_ratio) * 100);
    const dataHealth = {
        validation_score: validationScore,
        warnings: psdeResult.flags || [],
        critical_flags: allArchetypes.filter(a => a.detection_state === 'contradicted').map(a => a.archetype_name),
        ontology_health: snapshot.domain_confirmation_ratio > 0.5 ? 'Healthy' : 'Low Evidence',
        chronology_health: snapshot.gap_periods.length > 0 ? 'Review Required' : 'Healthy',
        confidence_health: snapshot.overall_signal_strength
    };

    // --- SECTION 12: RECRUITER VERDICT ---
    const recruiterVerdict = {
        final_recommendation: snapshot.overall_signal_strength === 'Strong' ? 'Strong Hire' : 'Conditional Match',
        flag_ratio: snapshot.flag_ratio,
        hire_signal: snapshot.overall_signal_strength,
        best_fit_roles: [currentRoleData.title, 'Strategic Lead', 'Domain Expert'].slice(0, 2),
        leadership_fit: clusterSummary.leadership > 0.7 ? 'Excellent' : 'Moderate',
        transformation_fit: clusterSummary.execution > 0.7 ? 'Strong' : 'Steady',
        risk_level: snapshot.flag_ratio > 0.3 ? 'High' : 'Low'
    };

    // --- EVIDENCE METRICS FOR WIREFRAME RINGS ---
    const strongAEUsCount = baseAEUs.filter(a => a.evidence_strength === 'strong').length;
    const ownedAEUsCount = baseAEUs.filter(a => a.decision_level === 'owned').length;
    const evidenceStats = {
        total_evidence_units: snapshot.total_aeus,
        strong_evidence_units: strongAEUsCount,
        owned_evidence_units: ownedAEUsCount,
        skills_found_count: snapshot.skills_total
    };

    return {
        user_id: extractedCV.candidate_id,
        header,
        executive_summary: executiveSummary,
        cluster_dashboard: { cluster_summary: clusterSummary },
        top_signals: topSignals,
        career_timeline: careerTimeline,
        impact_evidence: impactEvidence,
        leadership_insights: leadershipInsights,
        domain_intelligence: domainIntelligence,
        risk_signals: riskSignals,
        education_section: educationSection,
        extracted_cv: {
            skills: skills.map(s => ({
                skill_name: s.skill_name,
                category: s.category,
                is_proven: s.appears_in_role_bullets,
                appears_in_roles: s.appears_in_role_bullets ? ['Detected'] : [],
                recency: 'Current',
                source: s.source
            })),
            gap_periods: (extractedCV.precomputed_stats?.gapPeriods || []).map(g => ({
                between_roles: `Between Role ${g.after_role} and Role ${g.before_role}`,
                duration_months: g.gap_months,
                activity_detected: 'No activity detected in CV',
                flag_raised: g.gap_months > 6,
                source: `gap_periods[${g.after_role}]`
            })),
            credentials: credentials
        },
        evidence_stats: evidenceStats, // Added for Wireframe Zone 2 Rings & Top bar
        data_health: dataHealth,
        recruiter_verdict: recruiterVerdict,
        meta: {
            generated_at: new Date().toISOString(),
            version: '2.0.1-final',
            system_metrics: metrics || {
                total_tokens_input: 0,
                total_tokens_output: 0,
                processing_duration_ms: 0,
                estimated_cost_usd: 0
            }
        }
    };
}

/**
 * Helper: Determine career level based on months of experience
 */
function getCareerLevel(months) {
    if (months > 180) return 'Executive';
    if (months > 120) return 'Senior Manager';
    if (months > 60) return 'Lead / Mid-Career';
    if (months > 24) return 'Professional';
    return 'Early Career';
}

/**
 * Helper: Determine recommendation based on snapshot data
 */
function getRecommendation(snapshot) {
    if (snapshot.overall_signal_strength === 'Strong' && snapshot.flag_ratio < 0.1) return 'Move to Final Interview';
    if (snapshot.overall_signal_strength === 'Moderate') return 'Verify Leadership and Tenure';
    return 'Deep-dive into Career Gaps and Evidence';
}

module.exports = { generateReport };
