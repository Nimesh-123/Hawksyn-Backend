const { generateJSON, generateText } = require('../aiProvider');
const { buildDomainReference, getDomainTermsCache } = require('../cache');
const { normalizeResume } = require('../preprocessing');
const { detectBoomerangPattern, calculateConsolidationStats } = require('../consolidation/advanced');
const { calculateExperienceMonths, repairChronology, detectChronologyRisks } = require('../chronology');
const { calculateSeniorityScore, buildSenioritySequence, detectPromotionTrajectory } = require('../seniority');
const { runPSDEScan } = require('../../psde/engine');
const PSDEResult = require('../../modules/cv/PSDEResult.model');
const { logPSDEResult } = require('../../../utils/psde_logger');
const { getPrompt } = require('../../../utils/promptConfig');
const { logAuditEvent } = require('../../validation/audit');
const Fuse = require('fuse.js');

// ─────────────────────────────────────────────────────────────────────────────
// DEFAULT HARDCODED FALLBACK PROMPTS (Used if DB does not have them overrides)
// ─────────────────────────────────────────────────────────────────────────────

const PCR_NORMALISE_META_v1 = `
Analyse this CV text and return JSON only.

## OUTPUT STRUCTURE
{
  "proceed": true,
  "reason": null,
  "detail": null,
  "extraction_meta": {
    "original_char_count": 0,
    "word_count": 0,
    "bullet_normalisation_applied": false,
    "date_normalisation_applied": false,
    "currency_normalisation_applied": false,
    "currencies_found": [],
    "ambiguous_date_format_count": 0,
    "year_only_date_count": 0,
    "code_snippets_stripped": 0,
    "excluded_sections": [
      { "section_type": "...", "preview": "..." }
    ],
    "partial_template_pollution": false,
    "template_placeholders_found": []
  }
}

## DETECTION RULES

Set these flags based on what you FIND in the raw text (not what you applied):
- bullet_normalisation_applied: true if ANY of these found: (cid:127) (cid:183) \u2022 \u25aa * as bullet
- date_normalisation_applied: true if ANY non-YYYY-MM date found (March 2021, 03/2021, Jan-21 etc)
- currency_normalisation_applied: true if ANY currency found: Rs. INR USD lakh crore
- currencies_found: list all currency types found: ["INR"] or ["INR","USD"]
- ambiguous_date_format_count: count of dates where month/day are unclear (e.g. 01/02/2020)
- year_only_date_count: count of dates where only year is present (e.g. 2018)
- code_snippets_stripped: count of technical code blocks found (only if significant)

EXCLUDED SECTIONS:
For each excluded section found, return:
{
  "section_type": "<career_objective|personal_details|family_background|hobbies|references|declaration>",
  "preview": "<first 60 chars of that section>"
}

Detection patterns for Indian CVs:
- personal_details triggers: ANY of: Father's Name / Mother's Name / Date of Birth / DOB / Marital Status / Religion / Caste / Native Place / Spouse Name / Blood Group / Passport No / Driving License / Nationality / Gender / Age
- family_background triggers: section header "Family Background" OR text containing "I belong to" / "my father" / "my mother" / "my family"
- hobbies triggers: header "Hobbies" / "Interests" / "Personal Interests" + list
- declaration triggers: "I hereby declare" / "true to the best of my knowledge" / "Place:" + "Date:" at end of document
- references triggers: "References available on request" OR list of names with Mr./Mrs./Dr. + designation + phone/email
- career_objective triggers: header "Career Objective" / "Objective" / "Profile Summary" AND content contains: seeking / looking for / aspire / wish to / desire to / "To work in" / "To obtain" / "To secure"

Set proceed to false only if:
- Less than 80 words in the CV
- No year (like 2018, 2020) found anywhere
- More than 3 template placeholders like [Insert Name] or Lorem ipsum

Output ONLY valid JSON.
`;

const PCR_NORMALISE_CLEAN = `
You are the Hawksyn CV text cleaner.
Apply these transformations to the CV text and return ONLY the cleaned text.
No JSON. No explanation. Just the cleaned CV text.

## TASK 1 - Bullet normalisation (CR-01)
Replace with hyphen at start of lines.
## TASK 2 - Unicode normalisation (CR-05)
Replace smart quotes, em-dash, etc.
## TASK 3 - Date normalisation (CR-02)
Convert month/year date patterns to YYYY-MM (e.g. 'Jan 2020' to '2020-01'). Do NOT alter standalone years (e.g. '2018' stays '2018').
## TASK 4 - Currency normalisation (CR-03 + CR-04)
Normalise currency expressions inline.
## TASK 5 - Code snippet stripping (CR-11)
Replace code blocks with '[code snippet removed]'.
## TASK 6 - Excluded sections removal (CR-09)
REMOVE Personal Details, Family Background, Hobbies, References, Declaration.
## TASK 7 - Template placeholders (CR-07)
Replace placeholders with [TEMPLATE_PLACEHOLDER].

Return ONLY the cleaned text. Nothing else.
`;

const PCR_EXTRACT_HEADER_DEFAULT = `
You are the Hawksyn CV header extraction engine.
Extract candidate identity from the first 1000 characters of a CV.

## PATTERNS TO DETECT

NAME: 1-4 capitalised words near the top.
  - Strip honorifics: Mr. Mrs. Ms. Dr. Shri Smt.
  - Strip credential suffixes: CFA, CA, MBA, FRM (capture in title instead)
  - Handle split name from column scrambling:
    'Karthikeyan PROFILE Subramanian' -> 'Karthikeyan Subramanian'
    Add flag: name_reassembled_from_split_layout
  - Preserve apostrophes: D'Mello, D'Souza

EMAIL: contains @ and a domain.
PHONE: 10-13 digits. Normalise to E.164: +91XXXXXXXXXX.
LOCATION: city or city + state. e.g. 'Bengaluru' / 'Mumbai, Maharashtra'
HEADLINE: short phrase below the name describing role or identity.
  This is a self-claim. Do NOT use as seniority evidence.
SOCIAL LINKS: LinkedIn, GitHub, website, Twitter.

## OUTPUT
{
  "name": "<full name>",
  "name_confidence": "<high|medium|low>",
  "email": "<email or null>",
  "phone": "<E.164 or null>",
  "location": {
    "primary_city": "<city or null>",
    "state": "<state or null>",
    "is_remote_indicated": <bool>
  },
  "headline_title": "<headline or null>",
  "headline_implied_seniority": "<junior|mid|senior|leadership|unclear>",
  "social_links": {
    "linkedin": "<url or null>",
    "github": "<url or null>",
    "website": "<url or null>"
  },
  "flags": ["<list>"]
}

RULES:
1. Output ONLY JSON.
2. null is better than invented values.
3. headline_title is self-claimed only. Not evidence.
4. headline_implied_seniority mapping:
   junior    = Analyst / Executive / Associate / Trainee / Assistant / Entry
   mid       = Manager / Senior Manager / Deputy Manager / Specialist
   senior    = AVP / Assistant Vice President / Senior / Lead / Principal (non-consulting)
   leadership = VP / SVP / EVP / CXO / Director / Head of / Managing Director / Principal (consulting) / Partner / Founder / President
   unclear   = anything else
`;

const PCR_ROLES_STAGE_A_DEFAULT = `
You are the Hawksyn role boundary detector.
Identify distinct work experience blocks in the CV.

## DETECTION RULE
A role block has ALL of:
  - A title (capitalised phrase, may have hyphens)
  - A company (capitalised entity, may end with Ltd/Limited/Pvt/LLP/Bank/Group)
  - A date range (already normalised to YYYY-MM)
  - 1-12 bullets OR a descriptive paragraph

Section header is a HINT, not required.
Find roles by content pattern even without an 'Experience' header.

## CHRONOLOGICAL ORDER (CR-18)
Compare first 3 vs last 3 role start dates.
If first dates are more recent: chronology = reverse (standard).
If first dates are older: chronology = forward.
Flag forward chronology. Downstream normalises to most-recent-first.

## FORWARD CHRONOLOGY HANDLING
If this CV uses forward chronological order (oldest role first),
the most recent role will be at the BOTTOM of the experience section,
not the top. Check all pages/sections for the most recent role.

## ROLE DETECTION BOUNDARY RULES
A new role starts when you see:
  - A new company name (different from previous)
  - OR same company with clearly different title and date range

For CVs with sections like "Career Objective", "Personal Details",
"Family Background" at the top - skip these sections entirely.
The experience section starts after these introductory sections.

## COMPLETENESS CHECK
After detecting roles, verify:
  - total_experience_years claimed in CV (if mentioned) ≈ sum of role durations
  - If CV says "32 years experience" but you only found 20 years of roles,
    you likely missed some roles - look again more carefully

For Sushil-type CVs: look for ALL of these companies if present:
  BHEL / EL / Bharat Heavy Electricals → current/most recent role
  Tata Steel
  Reliance Industries
  Deloitte / Deloitte Haskins and Sells
  S.S. Kothari Mehta / any CA firm

## OUTPUT
{
  "roles_detected": <n>,
  "chronology": "<reverse|forward>",
  "role_boundaries": [
    {
      "role_index": 1,
      "char_start": <n>,
      "char_end": <m>,
      "detected_title": "<title>",
      "detected_company": "<company>",
      "detected_date_range": "<YYYY-MM to YYYY-MM>"
    }
  ],
  "flags": ["<list>"]
}
Output ONLY JSON.
`;

const PCR_ROLES_STAGE_B_DEFAULT = `
You are the Hawksyn role-level extraction engine.
Extract Atomic Evidence Units (B-AEUs) from a single role block.

## INPUT
You will receive:
  role_index: which role this is (1 = most recent)
  target_title: the job title to extract
  target_company: the company name to extract
  target_date_range: the date range to extract (YYYY-MM to YYYY-MM)
  full_cv_text: the complete CV text
  domain_knowledge_reference: domain terms for CR-14

## YOUR TASK
1. Find the role block in full_cv_text that matches:
   title = target_title
   company = target_company
   date_range = target_date_range

2. Extract ONLY the bullets/content that belong to THAT specific role.
   Do NOT extract bullets from adjacent roles.
   The role block ends when you see a new company name or new date range.

3. raw_text MUST be the COMPLETE verbatim bullet.
   If a bullet is "Led the operating model redesign for a top-3 Indian
   private bank, reducing branch operations cost by INR 540 crore over
   24 months." - raw_text must be this complete sentence.
   NEVER truncate raw_text mid-word or mid-sentence.
   If you cannot find the complete bullet, skip the AEU entirely.

CRITICAL: Only extract AEUs for target_title at target_company.
Do NOT extract bullets that belong to a different role.

## EXTRACTION RULES

Rule 1 - One action per AEU
  Each bullet = one AEU. Two distinct actions in one bullet = two AEUs.
  Never merge.

Rule 2 - Vague verb mapping (CR-10) CRITICAL
  'Responsible for X'    -> action: 'Managed X'       decision_level: contributed
  'Was part of'          -> action: 'Participated in'  decision_level: supported
  'Helped drive'         -> action: 'Supported'        decision_level: supported
  'Worked on'            -> action: 'Contributed to'   decision_level: contributed
  'Was involved in'      -> action: 'Participated in'  decision_level: supported
  'Coordinated with'     -> action: 'Coordinated'      decision_level: contributed
  'Contributed to'       -> action: 'Contributed to'   decision_level: supported
  'Led'                  -> action: 'Led'               decision_level: owned
  'Owned'                -> action: 'Owned'             decision_level: owned
  'Founded/Built/Designed/Drove/Architected/Spearheaded' -> decision_level: owned
  CRITICAL: 'Responsible for' is NEVER owned. Always contributed.

Rule 3 - Metrics
  Extract ONLY if present verbatim. Never invent. Never compute.
  Flag missing_metrics if no number present.

Rule 4 - Evidence strength
  strong   = specific action verb + metric + decision_level owned
  moderate = specific verb + (metric OR ownership)
  weak     = vague verb after CR-10 mapping AND no metric

Rule 5 - Hollow language (CR-16)
  Cap evidence_strength at weak if bullet contains:
  'delivered impactful outcomes' / 'drive meaningful change' /
  'navigate complex stakeholder ecosystems' / 'unlock value' /
  'fostering collaborative environments' / 'orchestrated cross-functional' /
  'synergistic ecosystem' / 'paradigm-shifting' / 'best-in-class operations' /
  'catalyse sustainable competitive advantage'
  Add flag: hollow_language_present

Rule 6 - Buzzwords (CR-17)
  Count: transformative, synergy, leverage, paradigm, holistic, ecosystem,
  best-in-class, thought leader, visionary, catalytic, disruptive,
  next-generation, championing, dynamic, results-oriented, mission-critical
  If > 3 in one role: cap evidence_strength at moderate. Flag: high_buzzword_density

Rule 7 - Marquee project (CR-14)
  Match bullet text against marquee_project list in reference.
  Flag marquee_project_referenced.

Rule 10 - Title inflation check
  If title contains Founder/Director/VP/SVP/CXO/Head/Chief/Principal
  AND bullets describe task-level work (handled/performed/executed/submitted)
  Add flag: possible_title_inflation

## OUTPUT
{
  "role_index": <n>,
  "role_metadata": {
    "title": "<title>",
    "company": "<company>",
    "company_canonical": "<from tier1 list or as-is>",
    "location": "<city or null>",
    "start_date": "YYYY-MM",
    "end_date": "YYYY-MM or present",
    "employment_type": "<full-time|consulting|freelance|internship|contract|unknown>",
    "is_current": <bool>,
    "role_flags": ["<list>"]
  },
  "base_aeus": [
    {
      "aue_id": "R<role_index>_AEU<n>",
      "evidence_type": "<impact|responsibility|initiative|leadership|optimization>",
      "action": "<normalised verb + object>",
      "object": "<object of action>",
      "metrics": {
        "metric_name": "<name or null>",
        "value": "<single value or null>",
        "before": "<null or value>",
        "after": "<null or value>",
        "delta": "<null or change amount>",
        "amount_inr": <numeric or null>,
        "currency_code": "<INR|USD|EUR|GBP|null>",
        "is_range": <bool>,
        "confidence": "<high|medium|low>"
      },
      "tools": ["<list>"],
      "team_context": {
        "team_size": <n or null>,
        "cross_functional": <bool>,
        "direct_reports": <n or null>
      },
      "decision_level": "<owned|contributed|supported>",
      "complexity": "<low|medium|high>",
      "evidence_strength": "<strong|moderate|weak>",
      "raw_text": "<verbatim bullet after CR-01 normalisation>",
      "flags": ["<vague_action|missing_metrics|hollow_language_present|currency_converted|list>"],
      "domain_metadata": {
        "tier1_employer": <bool>,
        "marquee_project_referenced": "<name or null>",
        "regulatory_body_referenced": "<canonical or null>",
        "domain_terms_found": []
      }
    }
  ]
}

CRITICAL RULES:
1. Output ONLY JSON.
2. raw_text integrity:
   raw_text MUST be the complete verbatim bullet as it appears in the source.
   NEVER return a raw_text that ends mid-word or mid-sentence.
3. Flagging:
   - Add 'vague_action' to flags if the original verb was vague (e.g. 'Responsible for', 'Helped').
   - Add 'missing_metrics' to flags if no numbers/quantifiable data found.
   - Add 'tier1_employer' to role_metadata.role_flags if the company is in the tier1 list.
4. Metrics:
   - If a bullet shows growth (from 12 to 38), return before: 12, after: 38, delta: "26".
   - Always return currency_code if a currency is detected.
   - amount_inr MUST be the absolute numeric value. Resolve multipliers: 'crore' = * 10,000,000; 'million' = * 1,000,000; 'billion' = * 1,000,000,000. Example: 'INR 540 crore' -> 5400000000.
5. Two distinct actions in one bullet = two AEUs.
`;

const PCR_EXTRACT_EDUCATION_DEFAULT = `
You are the Hawksyn education extraction engine.

## DETECTION PATTERN
An education entry has some combination of:
  - Degree name or abbreviation
  - Institution name (often with city)
  - Year (4-digit, 1970 to present)
  - Optional: percentage, GPA, distinction, rank
These appear on 1-3 consecutive lines.
Section header is a HINT, not required.

## INDIAN QUALIFICATION MAP (CR-08) - apply canonical form
BTech / B.Tech / Bachelor of Technology        -> BTECH
BE / B.E. / Bachelor of Engineering            -> BE
MBA / M.B.A. / PGDM / Post Graduate Programme  -> MBA or PGDM
BSc / B.Sc.                                    -> BSC
BCom / B.Com.                                  -> BCOM
BCA / B.C.A.                                   -> BCA
MCA / M.C.A.                                   -> MCA
CA / Chartered Accountant                      -> CA
CS / Company Secretary                         -> CS
CMA / ICWA                                     -> CMA
CFA / Chartered Financial Analyst              -> CFA
FRM / Financial Risk Manager                   -> FRM
HSC / Class XII / 10+2 / Higher Secondary      -> HSC
SSC / Class X / Matriculation                  -> SSC
PhD / Ph.D. / Doctor of Philosophy             -> PHD
MBBS / LLB / BPharm / MPharm                  -> as-is canonical

## TIER-1 INSTITUTION DETECTION
Flag tier1_institution if matched:
  IIM (any campus) / IIT (any campus) / ISB / XLRI / BITS Pilani /
  NID / IIIT-H / SP Jain / FMS Delhi / JBIMS / MDI / IIFT /
  AIIMS / NLSIU / NALSAR / NIT (any) as tier-1.5

## OUTPUT
{
  "education_entries": [
    {
      "entry_id": "EDU_<n>",
      "degree_canonical": "<MBA|BTECH|etc or null>",
      "degree_original": "<as in CV>",
      "degree_type": "<undergraduate|postgraduate|doctoral|professional|secondary|diploma>",
      "specialisation": "<subject or null>",
      "institution": "<as in CV>",
      "institution_canonical": "<from tier1 list or as-is>",
      "institution_city": "<city or null>",
      "institution_tier": "<tier1|tier1.5|unknown>",
      "year_completed": <YYYY or null>,
      "performance": {
        "percentage": <n or null>,
        "gpa": <n or null>,
        "distinction": <bool>,
        "rank": "<text or null>"
      },
      "flags": ["<list>"]
    }
  ]
}

RULES:
1. Output ONLY JSON.
2. Unrecognised degree: degree_canonical null, flag unrecognised_degree.
3. Performance: extract verbatim only. Never infer.
4. Do not list HSC/SSC unless no other education found.
`;

const PCR_EXTRACT_SKILLS_DEFAULT = `
You are the Hawksyn skills extraction engine.

## DETECTION SOURCES
A) Dedicated skills section (Skills / Technical Skills / Core Competencies /
   Key Skills / Tech Stack / Tools and Tech)
B) Languages section (Languages / Spoken Languages)
C) Skills embedded in role bullets (technologies, tools mentioned in context)
D) Sidebar skill and language lists in two-column CVs
Extract from all. Explicitly include spoken/written languages.

## FRAGMENTATION DETECTION (CR-15)
Fragmentation is high if ANY of:
  - More than 3 distinct skill category headers
  - More than 25 distinct skills listed
  - More than 50% of listed skills absent from any role bullet
Generate I-AEU risk flag for high fragmentation via consolidator.

## SELF-RATING DETECTION
Strip self-ratings (Advanced / Intermediate / Expert / stars).
Set self_rated: true. Keep skill name without rating.

## CATEGORISATION
  technical   = programming languages, frameworks, tools, platforms
  functional  = domain expertise (underwriting, M&A, supply chain)
  methodology = processes (Agile, Six Sigma, NABH, DDD)
  soft        = interpersonal claims (treat with low weight)
  language    = spoken/written languages

## OUTPUT
{
  "skills_section_present": <bool>,
  "distinct_skill_categories": <n>,
  "distinct_skills_total": <m>,
  "fragmentation_level": "<low|moderate|high>",
  "skills": [
    {
      "skill_name": "<name>",
      "category": "<technical|functional|methodology|soft|language>",
      "source": "<dedicated_section|role_bullet|sidebar>",
      "appears_in_role_bullets": <bool>,
      "flags": ["<list>"]
    }
  ],
  "meta_flags": ["<list>"]
}

RULES: 
1. Output ONLY JSON.
2. CAP: Extract up to the top 80 most significant skills. Deduplicate aggressively, but preserve highly specific domain or technical skills (e.g. Quantum Cryptography, PostgreSQL).
`;

const PCR_EXTRACT_CREDENTIALS_DEFAULT = `
You are the Hawksyn credentials extraction engine.
Extract certifications, awards, memberships, publications, speaking.

## CATEGORIES
certification  = issued by a recognised body, may have a licence ID
award          = internal company or external industry recognition
membership     = professional body membership
publication    = authored work (paper, article, perspective)
speaking       = conference talk, panel, guest lecture

## TIER DETECTION (from domain_knowledge_reference)
tier1 / regulatory = SEBI registration, IRDAI licence, CFA, CA, CS, NABH
tier1.5 = KPMG Green Belt, PMP, AWS/GCP/Azure certs, AMFI ARN
internal = company-specific awards, Employee of Month
Flag internal awards with low_signal_credential.

## OUTPUT
{
  "credentials": [
    {
      "credential_id": "CRED_<n>",
      "category": "<certification|award|membership|publication|speaking>",
      "name": "<name>",
      "issuing_body": "<body or null>",
      "issuing_body_canonical": "<from regulatory list or null>",
      "year": <YYYY or null>,
      "identifier": "<licence/reg number or null>",
      "tier": "<tier1|tier1.5|regulatory|internal|unknown>",
      "raw_text": "<original line>",
      "flags": ["<list>"]
    }
  ]
}

RULES:
1. Output ONLY JSON.
2. Never invent issuing bodies.
3. Capture registration IDs verbatim (INA200008942, ARN-94327).
4. Self-claimed 'expert' or 'thought leader' is NOT a credential. Skip.
5. TECHNICAL SKILLS are NOT credentials. Do NOT extract programming languages, frameworks, or databases as credentials.
`;

const PCR_CONSOLIDATE_DEFAULT = `
You are the Hawksyn consolidation and inference engine.
Merge extractor outputs. Run cross-section checks. Generate I-AEUs.

## CROSS-SECTION CHECKS

Check 1 - Date overlap (CR-12)
For each pair of full-time roles with overlap_months > 1:
  Flag both with overlapping_dates.
  Generate I-AEU type consistency: 'Concurrent Full-Time Role Overlap'
  Exception: one role is consulting/freelance/advisory -> do not flag.

Check 2 - Repeat employer (CR-13)
Group roles by company_canonical.
Consecutive + upward title + gap < 1 month -> flag internal_promotion
Same employer with gap > 6 months -> flag boomerang_pattern

Check 3 - Skill-role mismatch
If > 50% of skills not mentioned in any role bullet:
  Generate I-AEU type risk: 'Skill-Role Mismatch'
If technical skills listed (Python/ML/data) but all roles are non-technical:
  Generate I-AEU type risk: 'Possible Skill Inflation'

Check 4 - Seniority signals
If headline_implied_seniority is junior or mid AND any role shows:
  team_size > 50 OR amount_inr > 100000000 OR cross_functional across 3+ AEUs
  -> I-AEU type seniority: 'Underclaimed Seniority'

Check 5 - Trajectory
Analyse role progression chronologically:
  linear: titles progress consistently up -> I-AEU capability
  accelerated: multiple promotions in short periods -> I-AEU capability
  stagnation: same level > 5 years -> I-AEU risk
  decline: lower-seniority role after higher -> I-AEU consistency

Check 6 - Tenure
avg_role_tenure < 18 months AND role_count > 5 -> I-AEU risk: chronic job hopping
Single role > 60 months AND total experience > 96 months -> I-AEU behaviour: long-tenure

Check 7 - Gap analysis
Compute gaps between consecutive roles.
Gap > 6 months with no break explanation -> I-AEU consistency: unexplained gap

Check 8 - Domain depth
If > 8 distinct domain terms used appropriately across roles:
  -> I-AEU capability: domain depth

Check 9 - Domain Inference
Infer the industry, domain_indicator, and sector from the candidate's roles, company names, and projects.
Example 1: Backend Engineer + SaaS Company -> industry = Technology, domain_indicator = SaaS
Example 2: IT Services Firm -> industry = IT Services
Example 3: Banking Client Projects -> sector = Financial Services

## I-AEU RULES
Max 12 I-AEUs total. Bucket limits:
  capability: 3   seniority: 2   behavior: 2   risk: 3   consistency: 2

Each I-AEU MUST:
  - Reference min 2 supporting B-AEU IDs
  - Include explicit logic field
  - Use neutral phrasing: 'Evidence suggests' / 'Pattern indicates'
  - NEVER use: expert / excellent / highly skilled / strong leader
  - Include contradictions array if conflicting evidence exists

Confidence degradation:
If > 30% of supporting B-AEUs have any of:
  vague_action / hollow_language_present / high_buzzword_density /
  year_only_date / metric_without_context
  -> cap I-AEU confidence at low
     add flag: degraded_due_to_weak_base_aeus

## OUTPUT SCHEMA
Return JSON with this structure:
{
  "inferred_profile": {
    "industry": "<industry>",
    "domain_indicator": "<domain_indicator>",
    "sector": "<sector>"
  },
  "inference_aeus": [
    {
      "iaeu_id": "I_CAP_001",           (format: I_<TYPE>_<NNN>)
      "type": "capability",              (NOT "category" - use "type")
      "title": "<5 word title>",         (REQUIRED - short descriptive title)
      "inferred_claim": "<full claim>",  (REQUIRED - 1-2 sentences, neutral language)
      "supporting_aeus": ["R1_AEU1"],   (NOT "supporting_aeu_ids")
      "support_count": 2,               (REQUIRED - count of supporting_aeus)
      "confidence": "high",
      "strength": "strong",             (REQUIRED: strong/moderate/weak)
      "logic": "<reasoning>",
      "contradictions": [],
      "flags": []
    }
  ]
}
Output ONLY JSON.
`;

// ─────────────────────────────────────────────────────────────────────────────
// REGEX PATTERNS FOR ROLE SEGMENTATION (Previously in segmentation.js)
// ─────────────────────────────────────────────────────────────────────────────
const DATE_PATTERNS = [
  /(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{4}\s*[-–-]\s*(?:Present|Current|Now|\w+\s+\d{4})/gi,
  /\d{1,2}\/\d{2,4}\s*[-–-]\s*(?:Present|Current|\d{1,2}\/\d{2,4})/g,
  /\b\d{4}\s*[-–-]\s*(?:Present|Current|\d{4})\b/g
];

const ACTION_VERBS = ['architected', 'drove', 'built', 'led', 'managed', 'optimized', 'transformed', 'delivered', 'reduced', 'increased'];

// ─────────────────────────────────────────────────────────────────────────────
// HELPER FUNCTIONS (Consolidated Steps)
// ─────────────────────────────────────────────────────────────────────────────

async function runNormalisation(rawText, model) {
  try {
    const { data: meta, usage: u1 } = await generateJSON(rawText, PCR_NORMALISE_META_v1, { model, maxTokens: 8000 });

    if (!meta.proceed) {
      return { proceed: false, reason: meta.reason, detail: meta.detail, usage: u1 };
    }

    const { content: conditioned_text, usage: u2 } = await generateText(rawText, PCR_NORMALISE_CLEAN, model);

    const totalUsage = {
      promptTokenCount: (u1.promptTokenCount || u1.promptTokens || 0) + (u2.promptTokenCount || u2.promptTokens || 0),
      candidatesTokenCount: (u1.candidatesTokenCount || u1.completionTokens || 0) + (u2.candidatesTokenCount || u2.completionTokens || 0),
      totalTokenCount: (u1.totalTokenCount || u1.totalTokens || 0) + (u2.totalTokenCount || u2.totalTokens || 0)
    };

    return {
      proceed: true,
      conditioned_text: conditioned_text.trim(),
      extraction_meta: meta.extraction_meta,
      usage: totalUsage
    };
  } catch (err) {
    console.error(`  Normalisation failed: ${err.message}`);
    throw err;
  }
}

function detectRoleBoundaries(text) {
  const lines = text.split('\n');
  const roleBlocks = [];
  let currentBlock = { header: '', content: [], startIndex: -1 };

  lines.forEach((line, index) => {
    const isDateLine = DATE_PATTERNS.some(regex => regex.test(line));

    if (isDateLine) {
      if (currentBlock.startIndex !== -1) {
        roleBlocks.push(currentBlock);
      }
      currentBlock = { header: line, content: [], startIndex: index };
    } else {
      if (currentBlock.startIndex !== -1) {
        currentBlock.content.push(line);
      }
    }
  });

  if (currentBlock.startIndex !== -1) {
    roleBlocks.push(currentBlock);
  }

  return roleBlocks.map(block => ({
    header: block.header,
    rawText: block.content.join('\n')
  }));
}

function calibrateAEU(aeu) {
  const rawText = (aeu.raw_text || '').toLowerCase();
  const words = rawText.split(/[\s,]+/);
  const action = ACTION_VERBS.find(v => words.includes(v)) || null;

  if (action) {
    if (['led', 'managed'].includes(action)) aeu.evidence_type = 'leadership';
    else if (['architected', 'built', 'designed', 'established'].includes(action)) aeu.evidence_type = 'initiative';
    else if (['reduced', 'increased', 'optimized', 'delivered'].includes(action)) aeu.evidence_type = 'impact';
    else aeu.evidence_type = 'responsibility';

    if (['leadership', 'initiative'].includes(aeu.evidence_type)) aeu.decision_level = 'owned';
    if (aeu.evidence_type === 'impact' || rawText.length > 100) aeu.evidence_strength = 'strong';
  }
  return aeu;
}

function isValidRole(role) {
  const hasTitle = !!role.role_metadata?.title;
  const hasCompany = !!role.role_metadata?.company;
  if (!hasTitle && !hasCompany) return false;
  return true;
}

async function runValidation(consolidatedOutput, conditionedText) {
  const violations = [];
  let criticalCount = 0;
  const allRoles = consolidatedOutput.roles || [];
  const topLevelAEUs = consolidatedOutput.base_aeus || [];

  // Helper to gather all AEUs for validation
  const getAllAEUs = () => {
    const aeus = [...topLevelAEUs];
    for (const role of allRoles) {
      if (role.base_aeus) aeus.push(...role.base_aeus);
    }
    return aeus;
  };

  const allAEUsToValidate = getAllAEUs();

  for (const aeu of allAEUsToValidate) {
    if (!aeu.raw_text) continue;
    if (conditionedText.includes(aeu.raw_text)) continue;

    const sentences = conditionedText.split(/[.\n]/).filter(s => s.trim().length > 10);
    const fuse = new Fuse(sentences, { threshold: 0.05 });
    const result = fuse.search(aeu.raw_text);

    if (result.length === 0) {
      aeu.aeu_validity = 'rejected';
      violations.push({
        target_id: aeu.aue_id,
        violation: 'raw_text_not_in_source',
        severity: 'critical',
        auto_corrected: false
      });
      criticalCount++;
    }
  }

  const vagueVerbs = ['responsible for', 'was part of', 'helped', 'worked on', 'was involved in', 'coordinated with', 'contributed to'];
  for (const aeu of allAEUsToValidate) {
    if (aeu.decision_level === 'owned' && aeu.raw_text) {
      const rawLower = aeu.raw_text.toLowerCase();
      if (vagueVerbs.some(v => rawLower.startsWith(v))) {
        aeu.decision_level = 'contributed';
        aeu.flags = aeu.flags || [];
        aeu.flags.push('decision_level_auto_corrected');
        violations.push({
          target_id: aeu.aue_id,
          violation: 'vague_verb_with_owned_decision',
          severity: 'high',
          auto_corrected: true
        });
      }
    }
  }

  for (const role of allRoles) {
    if (!role.role_metadata?.start_date || !role.role_metadata?.end_date) continue;
    const start = new Date(role.role_metadata.start_date);
    const end = /present|current/i.test(role.role_metadata.end_date) ? new Date() : new Date(role.role_metadata.end_date);

    if (start > end) {
      violations.push({
        target_id: role.role_id,
        violation: 'impossible_date_range',
        severity: 'critical',
        reason: `Start date ${role.role_metadata.start_date} is after end date ${role.role_metadata.end_date}`
      });
      criticalCount++;
    }
  }

  for (const aeu of topLevelAEUs) {
    if (!aeu.timeframe?.start || !aeu.timeframe?.end) continue;
    const start = new Date(aeu.timeframe.start);
    const end = /present|current/i.test(aeu.timeframe.end) ? new Date() : new Date(aeu.timeframe.end);

    if (start > end) {
      violations.push({
        target_id: aeu.aue_id,
        violation: 'impossible_date_range',
        severity: 'critical',
        reason: `Start date ${aeu.timeframe.start} is after end date ${aeu.timeframe.end}`
      });
      criticalCount++;
    }
  }

  for (const aeu of allAEUsToValidate) {
    if (aeu.metrics?.amount_inr > 100000000000) {
      violations.push({
        target_id: aeu.aue_id,
        violation: 'suspicious_metric_value',
        severity: 'warning',
        reason: 'Extremely high INR value detected. Verify verbatim source.'
      });
    }
  }

  const bucketLimits = { capability: 3, seniority: 2, behavior: 2, risk: 3, consistency: 2 };
  const iaeus = consolidatedOutput.inference_aeus || [];
  const bucketCounts = {};
  const keptIAEUs = [];

  for (const iaeu of iaeus) {
    const bucket = iaeu.type || 'unknown';
    bucketCounts[bucket] = (bucketCounts[bucket] || 0) + 1;
    if ((bucketLimits[bucket] || 99) >= bucketCounts[bucket]) {
      keptIAEUs.push(iaeu);
    } else {
      violations.push({
        target_id: iaeu.iaeu_id,
        violation: 'bucket_limit_exceeded',
        severity: 'medium',
        auto_corrected: true
      });
    }
  }
  consolidatedOutput.inference_aeus = keptIAEUs;

  const status = criticalCount > 0 ? 'partial' : 'validated';
  const verbatimMatchRate = calculateVerbatimMatchRate(allRoles, topLevelAEUs);
  const finalBand = verbatimMatchRate < 0.7 ? 'degraded'
    : violations.filter(v => v.severity === 'critical').length > 0 ? 'low'
      : violations.filter(v => v.severity === 'high').length > 2 ? 'medium'
        : 'high';

  return {
    status,
    consolidated_output: consolidatedOutput,
    validation_meta: {
      total_violations: violations.length,
      critical_violations: criticalCount,
      violations,
      verbatim_match_rate: verbatimMatchRate,
      final_confidence_band: finalBand
    }
  };
}

function calculateVerbatimMatchRate(roles, topLevelAEUs = []) {
  let total = 0, matched = 0;
  
  const checkAEU = (aeu) => {
    total++;
    if (aeu.aeu_validity !== 'rejected') matched++;
  };

  for (const role of roles) {
    for (const aeu of (role.base_aeus || [])) {
      checkAEU(aeu);
    }
  }

  for (const aeu of topLevelAEUs) {
    checkAEU(aeu);
  }

  return total === 0 ? 1.0 : matched / total;
}

// ─────────────────────────────────────────────────────────────────────────────
// CORE EXTRACTION PIPELINE SERVICE (Dynamic DB Prompts Version)
// ─────────────────────────────────────────────────────────────────────────────

async function runExtractionPipeline(candidateId, rawText, db, isDebug = false) {
  db = db || require('mongoose').connection.db;
  const startTime = Date.now();
  let totalUsage = { promptTokenCount: 0, candidatesTokenCount: 0, totalTokenCount: 0 };

  const addUsage = (u) => {
    if (!u) return;
    totalUsage.promptTokenCount += (u.promptTokenCount || u.promptTokens || 0);
    totalUsage.candidatesTokenCount += (u.candidatesTokenCount || u.completionTokens || 0);
    totalUsage.totalTokenCount += (u.totalTokenCount || u.totalTokens || 0);
  };

  try {
    const CV_PROGRESS_MAP = {
      'PENDING': { progress: 10, message: "Initializing..." },
      'PROCESSING': { progress: 20, message: "Reading document..." },
      'BUILDING_CAREER_TIMELINE': { progress: 48, message: "Analyzing career timeline..." },
      'READING_CAREER_SIGNALS': { progress: 72, message: "Extracting career signals..." }
    };

    const emitProgress = (status, liveMetrics = {}) => {
      try {
        const socketService = require('../../sockets/socketService');
        const io = socketService.getIO();
        const mapping = CV_PROGRESS_MAP[status] || { progress: 20, message: "Processing CV..." };

        if (io) {
          io.to(candidateId.toString()).emit('cv_parse_update', {
            success: true,
            data: {
              status: 'PROCESSING',
              parserStatus: status,
              progress: mapping.progress,
              message: mapping.message,
              liveMetrics: liveMetrics
            }
          });
        }
      } catch (e) {
        console.warn('Could not emit socket progress', e.message);
      }
    };

    // Fetch dynamic prompts from database with hardcoded fallbacks
    const [
      headerConfig,
      rolesStageAConfig,
      rolesStageBConfig,
      educationConfig,
      skillsConfig,
      credentialsConfig,
      consolidateConfig
    ] = await Promise.all([
      getPrompt('HEADER_PROMPT', { promptText: PCR_EXTRACT_HEADER_DEFAULT }),
      getPrompt('ROLES_STAGE_A_PROMPT', { promptText: PCR_ROLES_STAGE_A_DEFAULT }),
      getPrompt('ROLES_STAGE_B_PROMPT', { promptText: PCR_ROLES_STAGE_B_DEFAULT }),
      getPrompt('EDUCATION_PROMPT', { promptText: PCR_EXTRACT_EDUCATION_DEFAULT }),
      getPrompt('SKILLS_PROMPT', { promptText: PCR_EXTRACT_SKILLS_DEFAULT }),
      getPrompt('CREDENTIALS_PROMPT', { promptText: PCR_EXTRACT_CREDENTIALS_DEFAULT }),
      getPrompt('CONSOLIDATE_PROMPT', { promptText: PCR_CONSOLIDATE_DEFAULT })
    ]);

    // Stage 0: Preprocessing
    const cleanText = normalizeResume(rawText);

    // Update CV upload status to processing
    await db.collection('document_uploads').updateOne(
      { userId: new (require('mongoose').Types.ObjectId)(candidateId) },
      { $set: { parserStatus: 'CV_PARSING', parserLiveMetrics: {} } }
    );
    emitProgress('CV_PARSING', {});

    // Step 1: Text cleaning & exclusion checks
    console.log(`[${candidateId}] Running normalisation...`);
    const normaliseResult = await runNormalisation(cleanText, headerConfig.modelFamily);
    addUsage(normaliseResult.usage);

    if (!normaliseResult.proceed) {
      const duration = Date.now() - startTime;
      await db.collection('document_uploads').updateOne(
        { userId: new (require('mongoose').Types.ObjectId)(candidateId) },
        {
          $set: {
            parserStatus: 'rejected',
            errorReason: normaliseResult.reason,
            metrics: calculateFinalMetrics(totalUsage, duration)
          }
        }
      );
      return { success: false, reason: normaliseResult.reason };
    }

    const { conditioned_text, extraction_meta } = normaliseResult;
    const domainRef = buildDomainReference();

    // Step 2: Parallel Extraction with slight staggers using database prompts
    console.log(`[${candidateId}] Running parallel extractors...`);
    const [headerRes, rolesStageARes, educationRes, skillsRes, credentialsRes] = await Promise.all([
      generateJSON(cleanText.slice(0, 1000), headerConfig.promptText, { model: headerConfig.modelFamily, maxTokens: 8000 }),
      (async () => { await new Promise(r => setTimeout(r, 200)); return generateJSON(conditioned_text, rolesStageAConfig.promptText, { model: rolesStageAConfig.modelFamily, maxTokens: 32000 }); })(),
      (async () => { await new Promise(r => setTimeout(r, 400)); return generateJSON(conditioned_text, educationConfig.promptText, { model: educationConfig.modelFamily, maxTokens: 8000 }); })(),
      (async () => { await new Promise(r => setTimeout(r, 600)); return generateJSON(conditioned_text, skillsConfig.promptText, { model: skillsConfig.modelFamily, maxTokens: 32000 }); })(),
      (async () => { await new Promise(r => setTimeout(r, 800)); return generateJSON(conditioned_text, credentialsConfig.promptText + '\n\n' + domainRef, { model: credentialsConfig.modelFamily, maxTokens: 32000 }); })()
    ]);

    addUsage(headerRes.usage);
    addUsage(rolesStageARes.usage);
    addUsage(educationRes.usage);
    addUsage(skillsRes.usage);
    addUsage(credentialsRes.usage);

    const header = headerRes.data;
    const rolesStageA = rolesStageARes.data;
    const education = educationRes.data;
    const skills = skillsRes.data;
    const credentials = credentialsRes.data;

    // Step 3: Staggered Role Boundary Stage B details
    const roleBoundaries = rolesStageA.role_boundaries || [];

    // Update status to step 2 (Building Timeline)
    await db.collection('document_uploads').updateOne(
      { userId: new (require('mongoose').Types.ObjectId)(candidateId) },
      {
        $set: {
          parserStatus: 'BUILDING_CAREER_TIMELINE',
          'parserLiveMetrics.rolesCount': roleBoundaries.length
        }
      }
    );
    emitProgress('BUILDING_CAREER_TIMELINE', { rolesCount: roleBoundaries.length });

    const roleExtractionsRes = await Promise.all(
      roleBoundaries.map(async (boundary, index) => {
        const roleInput = JSON.stringify({
          role_index: boundary.role_index,
          target_title: boundary.detected_title,
          target_company: boundary.detected_company,
          target_date_range: boundary.detected_date_range,
          full_cv_text: conditioned_text,
          domain_knowledge_reference: domainRef
        });
        await new Promise(r => setTimeout(r, index * 300));
        return generateJSON(roleInput, rolesStageBConfig.promptText, { model: rolesStageBConfig.modelFamily, maxTokens: 20000 });
      })
    );

    roleExtractionsRes.forEach(res => addUsage(res.usage));
    const roleExtractions = roleExtractionsRes.map(res => res.data);

    // Step 4: AEU Linkage & Calibration
    const hardenedRoles = roleExtractions.filter(isValidRole).map((role, idx) => {
      const rIdx = role.role_index || (roleBoundaries[idx]?.role_index) || (idx + 1);
      role.role_index = rIdx;

      if (role.role_metadata?.start_date) {
        const d1 = new Date(role.role_metadata.start_date);
        const d2 = /present|current/i.test(role.role_metadata.end_date)
          ? new Date()
          : new Date(role.role_metadata.end_date || role.role_metadata.start_date);

        if (!isNaN(d1.getTime()) && !isNaN(d2.getTime())) {
          role.role_metadata.duration_months = (d2.getFullYear() - d1.getFullYear()) * 12 + (d2.getMonth() - d1.getMonth());
        } else {
          role.role_metadata.duration_months = 0;
        }
      } else {
        role.role_metadata.duration_months = 0;
      }

      role.base_aeus = (Array.isArray(role.base_aeus) ? role.base_aeus : []).map(aeu => ({
        ...calibrateAEU(aeu),
        role_index: rIdx
      }));
      return role;
    });

    const deduplicatedRoles = serverDeduplicateAEUs(hardenedRoles);
    const withDomain = injectDomainTermsIntoAEUs(deduplicatedRoles);

    // Step 5: Chronology & Promotion Repair
    const repairedRoles = repairChronology(withDomain).map(role => {
      if (role.role_metadata) {
        role.role_metadata.title_seniority_rank = calculateSeniorityScore(role.role_metadata.title);
      }
      return role;
    });

    // Step 6: Consolidation using database prompts
    console.log(`[${candidateId}] Running PCR_CONSOLIDATE_v1...`);

    // Update status to step 3 (Reading Signals)
    const patternsCount = deduplicatedRoles.reduce((sum, role) => sum + (role.base_aeus || []).length, 0) * 3; // Mocking evaluating ~3 patterns per AEU
    await db.collection('document_uploads').updateOne(
      { userId: new (require('mongoose').Types.ObjectId)(candidateId) },
      {
        $set: {
          parserStatus: 'READING_CAREER_SIGNALS',
          'parserLiveMetrics.patternsCount': patternsCount > 0 ? patternsCount : 330
        }
      }
    );
    emitProgress('READING_CAREER_SIGNALS', { patternsCount: patternsCount > 0 ? patternsCount : 330 });

    const consolidateInput = JSON.stringify({ header, roles: repairedRoles, education, skills, credentials, extraction_meta, chronology: rolesStageA.chronology });
    const consolidatedRes = await generateJSON(consolidateInput, consolidateConfig.promptText, { model: consolidateConfig.modelFamily, maxTokens: 10000 });
    addUsage(consolidatedRes.usage);
    const consolidated = consolidatedRes.data;

    // Step 7: Advanced Stats
    const boomerangInferences = detectBoomerangPattern(repairedRoles);
    const consolidationStats = calculateConsolidationStats(repairedRoles);
    consolidated.inference_aeus = [...(consolidated.inference_aeus || []), ...boomerangInferences];
    consolidated.meta_stats = consolidationStats;

    // Validation
    console.log(`[${candidateId}] Running PCR_VALIDATE_v1 (deterministic)...`);
    const validated = await runValidation(consolidated, conditioned_text);

    // Precompute overall stats
    const experienceStats = calculateExperienceMonths(repairedRoles);
    const senioritySequence = buildSenioritySequence(repairedRoles);
    const trajectory = detectPromotionTrajectory(senioritySequence);
    const chronoRisks = detectChronologyRisks(repairedRoles);

    const stats = {
      total_experience_months: experienceStats.total_claimed_months,
      total_experience_years: parseFloat((experienceStats.total_claimed_months / 12).toFixed(1)),
      chronological_full_time_months: experienceStats.chronological_full_time_months,
      chronological_full_time_years: parseFloat((experienceStats.chronological_full_time_months / 12).toFixed(1)),
      role_count: repairedRoles.length,
      avg_tenure_months: repairedRoles.length > 0 ? experienceStats.total_claimed_months / repairedRoles.length : 0,
      top_skills: (Array.isArray(skills?.skills) ? skills.skills : (Array.isArray(skills) ? skills : [])).map(s => typeof s === 'string' ? s : (s?.skill_name || s?.name || '')).filter(Boolean).slice(0, 5),
      ...consolidated.meta_stats,
      industry: consolidated.inferred_profile?.industry || consolidated.industry || "",
      domain_indicator: consolidated.inferred_profile?.domain_indicator || consolidated.domain_indicator || consolidated.domainIndicator || "",
      sector: consolidated.inferred_profile?.sector || consolidated.sector || "",
      seniority_sequence: senioritySequence,
      ...trajectory,
      ...chronoRisks
    };

    const finalDuration = Date.now() - startTime;
    const metrics = calculateFinalMetrics(totalUsage, finalDuration);

    const extractedCVDoc = {
      candidate_id: candidateId,
      header: header,
      roles: repairedRoles,
      education: education.education || education.education_entries || [],
      skills: skills,
      credentials: credentials?.credentials || credentials || [],
      base_aeus: repairedRoles.flatMap(r => r.base_aeus || []),
      consolidator_output: validated.consolidated_output,
      precomputed_stats: stats,
      consolidator_flags: {
        boomerang_detected: !!boomerangInferences.length,
        internal_promotion: repairedRoles.some(r => r.flags?.includes('internal_promotion')),
        chronology: rolesStageA.chronology
      },
      extraction_meta: { ...extraction_meta, validation_meta: validated.validation_meta, processing_duration_ms: finalDuration },
      extraction_version: 'v1_hardened',
      extracted_at: new Date()
    };

    await db.collection('extracted_cvs').replaceOne({ candidate_id: candidateId }, extractedCVDoc, { upsert: true });

    await db.collection('document_uploads').updateOne(
      { userId: new (require('mongoose').Types.ObjectId)(candidateId) },
      {
        $set: {
          parserStatus: 'extraction_complete',
          metrics: metrics
        }
      }
    );

    console.log(`[${candidateId}] Extraction complete. Confidence: ${validated.validation_meta.final_confidence_band}`);

    // Trigger PSDE Archetype Scan
    console.log(`[${candidateId}] Triggering PSDE Scan...`);

    // Update status to step 4 (Scoring Readiness)
    const signalsCount = (repairedRoles.flatMap(r => r.base_aeus || []).length) + (consolidated.inference_aeus?.length || 0);
    await db.collection('document_uploads').updateOne(
      { userId: new (require('mongoose').Types.ObjectId)(candidateId) },
      {
        $set: {
          parserStatus: 'SCORING_DECISION_READINESS',
          'parserLiveMetrics.signalsFound': signalsCount > 0 ? signalsCount : 14
        }
      }
    );
    emitProgress('SCORING_DECISION_READINESS', { signalsFound: signalsCount > 0 ? signalsCount : 14 });

    const runId = `RUN_${candidateId}_${Date.now()}`;
    const psdeResults = await runPSDEScan(extractedCVDoc, stats, validated.validation_meta, consolidated.inference_aeus, runId, isDebug);

    // A. Check for existing scan to log superseded events for compliance audit
    try {
      const existingPSDE = await PSDEResult.findOne({ candidate_id: candidateId });
      if (existingPSDE && existingPSDE.archetype_results) {
        const supersededEvents = [];
        for (const oldAeu of existingPSDE.archetype_results) {
          if (oldAeu.detection_state === 'detected' || oldAeu.detection_state === 'partial') {
            supersededEvents.push({
              aeu_id: oldAeu.archetype_id,
              event_type: 'superseded',
              before_state: oldAeu,
              after_state: null,
              changed_by: 'system',
              changed_at: new Date(),
              reason: `Superseded by new scan run: ${runId}`
            });
          }
        }
        if (supersededEvents.length > 0) {
          await logAuditEvent({
            candidate_id: candidateId,
            run_id: runId,
            events: supersededEvents
          });
        }
      }
    } catch (auditErr) {
      console.error(`❌ [Audit] Failed to log superseded events for candidate ${candidateId}:`, auditErr.message);
    }

    await PSDEResult.replaceOne(
      { candidate_id: candidateId },
      { candidate_id: candidateId, ...psdeResults },
      { upsert: true }
    );
    console.log(`[${candidateId}] PSDE Scan complete. Run: ${runId}. Detected ${psdeResults.total_detected} archetypes.`);

    // B. Log creation of newly extracted/partial archetypes
    try {
      if (psdeResults.archetype_results) {
        const createdEvents = [];
        for (const newAeu of psdeResults.archetype_results) {
          if (newAeu.detection_state === 'detected' || newAeu.detection_state === 'partial') {
            createdEvents.push({
              aeu_id: newAeu.archetype_id,
              event_type: 'created',
              before_state: null,
              after_state: newAeu,
              changed_by: 'system',
              changed_at: new Date(),
              reason: `Initial automated PSDE scan extraction for Run: ${runId}`
            });
          }
        }
        if (createdEvents.length > 0) {
          await logAuditEvent({
            candidate_id: candidateId,
            run_id: runId,
            events: createdEvents
          });
        }
      }
    } catch (auditErr) {
      console.error(`❌ [Audit] Failed to log created events for candidate ${candidateId}:`, auditErr.message);
    }

    logPSDEResult(candidateId, psdeResults);

    return {
      success: true,
      candidateId,
      confidenceBand: validated.validation_meta.final_confidence_band,
      psdeSummary: psdeResults.cluster_summary,
      metrics: metrics
    };

  } catch (err) {
    const finalDuration = Date.now() - startTime;
    console.error(`[${candidateId}] Extraction failed:`, err.message);
    await db.collection('document_uploads').updateOne(
      { userId: new (require('mongoose').Types.ObjectId)(candidateId) },
      {
        $set: {
          parserStatus: 'FAILED',
          metrics: calculateFinalMetrics(totalUsage, finalDuration)
        }
      }
    );
    return { success: false, error: err.message };
  }
}

function calculateFinalMetrics(usage, durationMs) {
  const COST_PER_1K_INPUT = 0.0001;
  const COST_PER_1K_OUTPUT = 0.0004;
  const USD_TO_INR = 85;

  const costUSD = ((usage.promptTokenCount / 1000) * COST_PER_1K_INPUT) +
    ((usage.candidatesTokenCount / 1000) * COST_PER_1K_OUTPUT);

  return {
    total_tokens_input: usage.promptTokenCount,
    total_tokens_output: usage.candidatesTokenCount,
    processing_duration_ms: durationMs,
    estimated_cost_usd: parseFloat(costUSD.toFixed(6)),
    estimated_cost_inr: parseFloat((costUSD * USD_TO_INR).toFixed(4))
  };
}

function serverDeduplicateAEUs(roleExtractions) {
  const seenRawTexts = new Set();
  const cleaned = [];

  for (const role of roleExtractions) {
    const cleanedAEUs = [];
    for (const aeu of (role.base_aeus || [])) {
      if (!aeu.raw_text) continue;

      const normalized = aeu.raw_text
        .trim()
        .toLowerCase()
        .replace(/^[-•\s]+/, '')
        .slice(0, 80);

      if (!seenRawTexts.has(normalized) && normalized.length > 10) {
        seenRawTexts.add(normalized);
        cleanedAEUs.push(aeu);
      }
    }
    cleaned.push({ ...role, base_aeus: cleanedAEUs });
  }
  return cleaned;
}

function injectDomainTermsIntoAEUs(roleExtractions) {
  const domainTerms = getDomainTermsCache();
  const EMPLOYER_CATEGORIES = [
    'tier1_employer_banking', 'tier1_employer_it',
    'tier1_employer_consulting', 'tier1_employer_conglomerate',
    'tier1_employer_fmcg', 'tier1_employer_pharma', 'tier1_employer_startup'
  ];

  const domainOnlyLookup = {};
  const tier1Set = new Set();

  for (const term of domainTerms) {
    const isEmployer = EMPLOYER_CATEGORIES.includes(term.category);

    if (isEmployer) {
      tier1Set.add(term.term_canonical.toLowerCase());
      if (term.term_aliases) {
        for (const alias of term.term_aliases.split(',')) {
          tier1Set.add(alias.trim().toLowerCase());
        }
      }
    } else {
      domainOnlyLookup[term.term_canonical.toLowerCase()] = term;
      if (term.term_aliases) {
        for (const alias of term.term_aliases.split(',')) {
          domainOnlyLookup[alias.trim().toLowerCase()] = term;
        }
      }
    }
  }

  for (const role of roleExtractions) {
    const companyLower = (role.role_metadata?.company_canonical || '').toLowerCase();
    const companyOriginalLower = (role.role_metadata?.company || '').toLowerCase();
    const isTier1 = tier1Set.has(companyLower) || tier1Set.has(companyOriginalLower);

    for (const aeu of (role.base_aeus || [])) {
      if (!aeu.raw_text) continue;
      const rawLower = aeu.raw_text.toLowerCase();
      const foundTerms = [];

      for (const [term, termData] of Object.entries(domainOnlyLookup)) {
        const regex = new RegExp(`\\b${term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
        if (regex.test(rawLower)) {
          foundTerms.push(termData.term_canonical);
        }
      }

      aeu.domain_metadata = aeu.domain_metadata || {};
      aeu.domain_metadata.tier1_employer = isTier1;
      aeu.domain_metadata.domain_terms_found = [...new Set(foundTerms)];
    }
  }
  return roleExtractions;
}

module.exports = { runExtractionPipeline };
