/**
 * PSDE Text Library & Outcome Resolver
 * Centralized repository for all recruiter-facing copy and display logic.
 */

const TEXT_LIBRARY = {
  // ── SIDEBAR ──
  OS_SB_STR_01: { display: 'Strong', colour: 'teal' },
  OS_SB_STR_02: { display: 'Moderate', colour: 'amber' },
  OS_SB_STR_03: { display: 'Thin', colour: 'grey' },
  OS_SB_STR_04: { display: 'Insufficient', colour: 'red' },

  OS_SB_QUAL_01: { template: '{pct}% — High', colour: 'teal' },
  OS_SB_QUAL_02: { template: '{pct}% — Moderate', colour: 'amber' },
  OS_SB_QUAL_03: { template: '{pct}% — Low', colour: 'grey' },

  // ── SCREEN 1 — Timeline Insight ──
  OS_Z1_INS_01: {
    signal_name: 'Strong career arc',
    one_line: 'Your career has moved consistently upward over {career_years} years.',
    explanation: 'Hawksyn detected a clear upward seniority progression across your roles. Each transition moved you to a more senior position.',
    so_what: 'This is a strong positive signal. Recruiters will see a candidate who grows, not stagnates.'
  },
  OS_Z1_INS_02: {
    signal_name: 'Late acceleration',
    one_line: 'Slow early career, strong acceleration in recent years.',
    explanation: 'Your early roles showed limited progression, but your recent roles show rapid seniority gains.',
    so_what: 'Your recent trajectory is your strongest asset. Lead with your last 3 roles in conversations.'
  },
  OS_Z1_INS_03: {
    signal_name: 'Career plateau detected',
    one_line: 'No meaningful seniority growth detected over {career_years} years.',
    explanation: 'Your roles show similar seniority levels across your career. No clear upward arc was detected.',
    so_what: 'This does not mean your work lacked value — but the CV does not communicate growth. Consider reframing your role titles.'
  },
  OS_Z1_INS_04: {
    signal_name: 'Fragmented trajectory',
    one_line: 'Career pattern appears non-linear or fragmented.',
    explanation: 'Your roles do not follow a clear progression — multiple directions, mixed seniority levels, or frequent shifts.',
    so_what: 'Non-linear careers are valid but need narrative support. Prepare a clear story for why each move made sense.'
  },

  // ── Evidence Depth (Zone 2) ──
  OS_Z2_INS_01: {
    signal_name: 'Very thin evidence',
    one_line: 'Low ownership and weak outcomes across your career.',
    explanation: 'Most of your bullets describe tasks, not results. And most describe shared rather than personal contributions.',
    so_what: 'Rewrite your CV to show what you personally owned and what specifically changed because of your work.'
  },
  OS_Z2_INS_02: {
    signal_name: 'Contributed, not led',
    one_line: 'Solid contribution evidence but limited personal ownership.',
    explanation: 'Your work is well-documented in outcomes, but most is described as team or shared work.',
    so_what: 'Identify 3–5 things you truly owned. Rewrite those bullets in the first person with specific results.'
  },
  OS_Z2_INS_03: {
    signal_name: 'Strong outcomes, shared credit',
    one_line: 'Good outcome evidence, but ownership is distributed.',
    explanation: 'Your CV documents strong results but frames most as team achievements.',
    so_what: 'Where you personally drove a result, say so explicitly. "I led" is different from "the team delivered".'
  },
  OS_Z2_INS_04: {
    signal_name: 'Owner with thin proof',
    one_line: 'You owned work but the results are not documented.',
    explanation: 'You describe yourself as the decision-maker across many bullets, but few bullets include measurable outcomes.',
    so_what: 'Add numbers. Even approximate ones. "Reduced by ~30%" is more credible than "significantly improved".'
  },
  OS_Z2_INS_05: {
    signal_name: 'Balanced profile',
    one_line: 'Moderate ownership and outcome evidence. Room to strengthen.',
    explanation: 'Your evidence profile is average — a mix of owned and contributed work, with some measurable outcomes.',
    so_what: 'Focus on your top 10 achievements and make sure each has a verb (led/owned/built) and a number.'
  },
  OS_Z2_INS_06: {
    signal_name: 'Solid contribution',
    one_line: 'Good outcomes with clear contribution evidence.',
    explanation: 'You document results well and show meaningful contribution across your career.',
    so_what: 'Strong profile. Surface your personal ownership on 3–4 key achievements to push this to the top tier.'
  },
  OS_Z2_INS_07: {
    signal_name: 'Leader without outcomes',
    one_line: 'High ownership claims but few measurable results.',
    explanation: 'You position yourself as the decision-maker often, but your results are rarely quantified.',
    so_what: 'A leader who cannot show results raises questions. Add 3–5 concrete numbers to your highest-responsibility bullets.'
  },
  OS_Z2_INS_08: {
    signal_name: 'Strong ownership profile',
    one_line: 'Clear decision-maker with documented outcomes.',
    explanation: 'You demonstrate personal ownership and back it with results. Above-average evidence depth.',
    so_what: 'Strong profile. Lead with your owned, outcome-backed bullets in any recruiter conversation.'
  },
  OS_Z2_INS_09: {
    signal_name: 'Exceptional depth',
    one_line: 'Full ownership with strong, verifiable outcomes.',
    explanation: 'Top-tier evidence profile. You own your work, you document results, and your claims are verifiable.',
    so_what: 'Your CV speaks for itself. Make sure this quality shows up in your interview answers too.'
  },

  // ── Skills Warning (Zone 3) ──
  OS_Z3_SK_WARN_01: {
    signal_name: 'No skills proven',
    one_line: 'None of your listed skills appear in your actual work.',
    explanation: 'Every skill on your CV exists only in the skills section. None appear in any role description.',
    so_what: 'This is a critical gap. If you use these skills, mention them in your role bullets with a specific example.'
  },
  OS_Z3_SK_WARN_02: {
    signal_name: 'Severe skills gap',
    one_line: 'Very few of your listed skills are backed by work evidence.',
    explanation: 'Most of your skills section is unsupported by your role descriptions. Hawksyn could only confirm a small number.',
    so_what: 'Remove skills you cannot demonstrate in at least one role. The gap hurts more than the skill list helps.'
  },
  OS_Z3_SK_WARN_03: {
    signal_name: 'Moderate skills gap',
    one_line: 'Some skills are proven, but a significant gap remains.',
    explanation: 'Roughly half your listed skills are backed by your work history. The rest are claimed but unverified.',
    so_what: 'Go through each unproven skill. Either add a bullet that uses it, or remove it from the skills list.'
  },
  OS_Z3_SK_WARN_04: {
    signal_name: 'Skills well-evidenced',
    one_line: 'Most of your skills are backed by actual work evidence.',
    explanation: 'The majority of skills you list appear in your role descriptions. Hawksyn found strong evidence alignment.',
    so_what: 'Strong skills section. If any skills still show as unproven, consider adding a brief example to close the gap.'
  },

  // ── Domain Insight (Zone 3) ──
  OS_Z3_DM_INS_01: {
    signal_name: 'Domain depth confirmed',
    one_line: 'Your primary domain is {primary_domain}. Confirmed across {domain_confirmed_count} evidence points.',
    explanation: 'Hawksyn detected strong domain depth. Your domain terms appear consistently across multiple roles.',
    so_what: 'Your domain expertise is well-evidenced. This is a significant differentiator in senior roles.'
  },
  OS_Z3_DM_INS_02: {
    signal_name: 'Moderate domain coverage',
    one_line: 'Partial domain depth in {primary_domain}. {domain_confirmed_count} of {domain_mentioned_count} areas confirmed.',
    explanation: 'Some domain knowledge is evidenced across your roles, but coverage is inconsistent.',
    so_what: 'Strengthen your domain presence by making sure key terms appear in at least 2 different role descriptions.'
  },
  OS_Z3_DM_INS_03: {
    signal_name: 'Domain claims unconfirmed',
    one_line: 'Low domain confirmation in {primary_domain}. Only {domain_confirmed_count} areas verified.',
    explanation: 'Most domain terms appear only once or are mentioned without work context.',
    so_what: 'If {primary_domain} is your domain, your CV needs to show it more consistently across roles.'
  },

  // ── Zero States ──
  ZERO_SKILLS: { display: 'No skills section detected in your CV. Hawksyn could not evaluate skill evidence.' },
  ZERO_DOMAIN: { display: 'No domain terms were detected in your CV. A richer work description will improve this.' },
  ZERO_ROLES: { display: 'No roles were detected in your CV.' },
  ZERO_CREDS: { display: 'No credentials, certifications or awards were found in your CV.' },

  // ── Signal Type Tags ──
  OS_SIG_TYPE_01: { display: 'Strength', colour: 'teal' },
  OS_SIG_TYPE_02: { display: '⚠ Flag', colour: 'red' },
  OS_SIG_TYPE_03: { display: 'Watch', colour: 'amber' },
  OS_SIG_TYPE_04: { display: 'Hidden Asset', colour: 'blue' },
  OS_SIG_TYPE_05: { display: 'Context', colour: 'grey' },

  OS_SIG_CONF_01: { display: 'High', colour: 'teal' },
  OS_SIG_CONF_02: { display: 'Med', colour: 'amber' },
  OS_SIG_CONF_03: { display: 'Low', colour: 'grey' },

  OS_SIG_STATUS_01: { display: 'DETECTED', colour: 'teal' },
  OS_SIG_STATUS_03: { display: 'not detected', colour: 'grey' },

  // ── Polarity Tags ──
  OS_POL_01: { display: 'Positive', colour: 'teal' },
  OS_POL_02: { display: 'Negative', colour: 'red' },
  OS_POL_03: { display: 'Neutral', colour: 'grey' },
  OS_POL_04: { display: 'Context', colour: 'amber' },

  // ── SCREEN 3 — Signals Overview ──
  OS_SG_FINGER_01: {
    title: 'WHAT THIS FINGERPRINT TELLS YOU',
    text: 'You are strongest in {strongest_cluster} and {second_strongest_cluster}. Hawksyn found clear evidence of expanding responsibility and deep industry knowledge. Your Skills cluster has flags worth addressing. Visibility is low — you have done significant work that the outside world cannot yet see.'
  },
  OS_SG_TAKE_01: {
    type: 'pos',
    text: '<strong>You are a proven strategic operator.</strong> This is not a claim — it fires from your work pattern across multiple roles. Most people at your level cannot prove this from evidence.'
  },
  OS_SG_TAKE_02: {
    type: 'neg',
    text: '<strong>Your skills list is hurting you.</strong> Fragmentation signal fired. Too many unrelated skills with no depth. Clean it down to 8-10 skills and make every single one evidence-backed.'
  },
  OS_SG_TAKE_03: {
    type: 'warn',
    text: '<strong>You are invisible outside your company.</strong> At a senior leadership level, this limits your opportunities. One conference talk or one published article will change this signal permanently.'
  }
};

/**
 * Resolves the appropriate library text based on snapshot data.
 */
function resolveOutcomeState(positionId, snapshot) {
  switch (positionId) {
    case 'T_SB_STAT_STR_VAL':
      if (snapshot.overall_signal_strength === 'Strong') return TEXT_LIBRARY.OS_SB_STR_01;
      if (snapshot.overall_signal_strength === 'Moderate') return TEXT_LIBRARY.OS_SB_STR_02;
      if (snapshot.overall_signal_strength === 'Thin') return TEXT_LIBRARY.OS_SB_STR_03;
      return TEXT_LIBRARY.OS_SB_STR_04;

    case 'T_SB_STAT_QUAL_VAL':
      const pct = Math.round(snapshot.pct_strong * 100);
      if (snapshot.pct_strong >= 0.65) return { ...TEXT_LIBRARY.OS_SB_QUAL_01, display: `${pct}% — High` };
      if (snapshot.pct_strong >= 0.40) return { ...TEXT_LIBRARY.OS_SB_QUAL_02, display: `${pct}% — Moderate` };
      return { ...TEXT_LIBRARY.OS_SB_QUAL_03, display: `${pct}% — Low` };

    case 'T_EV_Z1_INSIGHT_TXT':
      const arcType = snapshot.c1_arc_type || 'FRAGMENTED';
      const stateMap = {
        STRONG_UPWARD: TEXT_LIBRARY.OS_Z1_INS_01,
        SLOW_START: TEXT_LIBRARY.OS_Z1_INS_02,
        STAGNANT: TEXT_LIBRARY.OS_Z1_INS_03,
        FRAGMENTED: TEXT_LIBRARY.OS_Z1_INS_04
      };
      return substituteTpl(stateMap[arcType] || stateMap.FRAGMENTED, snapshot);

    case 'T_EV_Z2_INSIGHT_TXT':
      return resolveZ2Insight(snapshot);

    case 'T_EV_Z3_SK_WARN_TXT':
      if (!snapshot.skills_total) return TEXT_LIBRARY.ZERO_SKILLS;
      const ratio = snapshot.skills_proven_ratio;
      if (ratio === 0) return TEXT_LIBRARY.OS_Z3_SK_WARN_01;
      if (ratio <= 0.30) return TEXT_LIBRARY.OS_Z3_SK_WARN_02;
      if (ratio <= 0.60) return TEXT_LIBRARY.OS_Z3_SK_WARN_03;
      return TEXT_LIBRARY.OS_Z3_SK_WARN_04;

    case 'T_EV_Z3_DM_INSIGHT_TXT':
      if (!snapshot.domain_mentioned) return TEXT_LIBRARY.ZERO_DOMAIN;
      const dmRatio = snapshot.domain_confirmation_ratio;
      if (dmRatio > 0.60) return substituteTpl(TEXT_LIBRARY.OS_Z3_DM_INS_01, snapshot);
      if (dmRatio >= 0.30) return substituteTpl(TEXT_LIBRARY.OS_Z3_DM_INS_02, snapshot);
      return substituteTpl(TEXT_LIBRARY.OS_Z3_DM_INS_03, snapshot);

    case 'T_SG_Z1_FINGERPRINT':
      return substituteTpl(TEXT_LIBRARY.OS_SG_FINGER_01, snapshot);

    case 'T_SG_Z2_TAKEAWAYS':
      return [
        TEXT_LIBRARY.OS_SG_TAKE_01,
        TEXT_LIBRARY.OS_SG_TAKE_02,
        TEXT_LIBRARY.OS_SG_TAKE_03
      ];

    default:
      return null;
  }
}

function resolveZ2Insight(snapshot) {
  const ownedBand = snapshot.pct_owned < 0.20 ? 'low'
    : snapshot.pct_owned <= 0.50 ? 'mid' : 'high';
  const strongBand = snapshot.pct_strong < 0.40 ? 'low'
    : snapshot.pct_strong <= 0.65 ? 'mid' : 'high';

  const matrix = {
    'low-low': TEXT_LIBRARY.OS_Z2_INS_01,
    'low-mid': TEXT_LIBRARY.OS_Z2_INS_02,
    'low-high': TEXT_LIBRARY.OS_Z2_INS_03,
    'mid-low': TEXT_LIBRARY.OS_Z2_INS_04,
    'mid-mid': TEXT_LIBRARY.OS_Z2_INS_05,
    'mid-high': TEXT_LIBRARY.OS_Z2_INS_06,
    'high-low': TEXT_LIBRARY.OS_Z2_INS_07,
    'high-mid': TEXT_LIBRARY.OS_Z2_INS_08,
    'high-high': TEXT_LIBRARY.OS_Z2_INS_09,
  };
  return matrix[`${ownedBand}-${strongBand}`] || TEXT_LIBRARY.OS_Z2_INS_05;
}

function substituteTpl(entry, snapshot) {
  if (!entry) return null;
  const vars = {
    career_years: Math.round(snapshot.total_career_months / 12),
    primary_domain: snapshot.primary_domain || 'your field',
    domain_confirmed_count: snapshot.domain_confirmed || 0,
    domain_mentioned_count: snapshot.domain_mentioned || 0,
    pct: Math.round(snapshot.pct_strong * 100),
    strongest_cluster: snapshot.strongest_cluster || 'Strategy',
    second_strongest_cluster: snapshot.second_strongest_cluster || 'Execution'
  };
  const result = { ...entry };
  for (const key of ['one_line', 'explanation', 'so_what', 'display', 'template', 'text', 'title']) {
    if (result[key]) {
      result[key] = result[key].replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? `{${k}}`);
    }
  }
  return result;
}

module.exports = { TEXT_LIBRARY, resolveOutcomeState, substituteTpl };
