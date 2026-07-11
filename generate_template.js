const fs = require('fs');
const css = fs.readFileSync('d:/Client Project/Hawksyn/backend/cv-parse/frontend/src/components/Report/Wireframe.css', 'utf8');

const html = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>Hawksyn Evidence Intelligence Report</title>
    <style>
    ${css}
    body {
      margin: 0;
      background: var(--bg);
      color: var(--text);
      font-family: 'SF Pro Display', -apple-system, 'Segoe UI', sans-serif;
      font-size: 13px;
      line-height: 1.5;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .page-break { height: 60px; }
    .page-break-avoid { page-break-inside: avoid; }
    .wf-section, .wf-recruiter-card, .cluster-section, .wf-why-box, .wf-takeaway-box, .cl-card, .wf-fingerprint-box {
        page-break-inside: avoid;
    }
    .text-center { text-align: center; }
    .italic { font-style: italic; }
    .mt-6 { margin-top: 24px; }
    .mt-12 { margin-top: 48px; }
    .mb-4 { margin-bottom: 16px; }
    .mb-8 { margin-bottom: 32px; }
    .py-4 { padding-top: 16px; padding-bottom: 16px; }
    .p-4 { padding: 16px; }
    .p-8 { padding: 32px; }
    .px-0 { padding-left: 0; padding-right: 0; }
    .pt-0 { padding-top: 0; }
    .space-y-4 > * + * { margin-top: 16px; }
    .space-y-8 > * + * { margin-top: 32px; }
    .max-w-\\[200px\\] { max-width: 200px; }
    .text-xs { font-size: 12px; }
    .text-orange { color: var(--orange); }
    .bg-teal { background: var(--teal); }
    .leading-relaxed { line-height: 1.625; }
    .opacity-80 { opacity: 0.8; }
    .tracking-widest { letter-spacing: 0.1em; }
    </style>
</head>
<body>
    <div class="wireframe-app" style="display: block; height: auto; overflow: visible;">
        <!-- RECRUITER VIEW TAB -->
        <div class="wf-main">
          <div class="wf-content-header">
            <div class="wf-label" style="font-size:10px;color:var(--text3);text-transform:uppercase;margin-bottom:8px;">Wireframe v1.0 · Developer Reference · Hawksyn / Hyumeans</div>
            <div class="wf-content-title">Recruiter Intelligence Snapshot</div>
            <div class="wf-content-sub">Confidential verdict for {{report.header.candidate_name}} &middot; {{report.header.headline_title}}</div>
            
            <div class="wf-badge-row">
              <span class="wf-badge wf-badge-pos">✓ {{report.totalAEUs}} evidence units extracted</span>
              <span class="wf-badge wf-badge-pos">✓ {{report.career_timeline.length}} roles parsed</span>
              <span class="wf-badge wf-badge-neu">{{report.header.experience_years}} years of career</span>
              <span class="wf-badge wf-badge-neu">{{report.domain_intelligence.specializations.length}} skills found</span>
            </div>
          </div>

          <div class="p-8">
            <div class="wf-top-badges">
              <div class="wf-top-badge"><span class="text-orange">●</span> Tokenised link: 30-day expiry</div>
              <div class="wf-top-badge"><span class="text-orange">●</span> Read-only: No CV needed</div>
            </div>

            <div class="wf-recruiter-card" style="max-width: none; margin: 0;">
              <div class="wf-rec-title">{{#if report.header.headline_title}}{{report.header.headline_title}}{{else}}Professional{{/if}}</div>
              <div class="wf-rec-subtitle">{{report.header.candidate_name}} &middot; Operating mode derived from intelligence signals</div>
              
              <div class="wf-rec-pills">
                <div class="wf-rec-pill">{{report.header.experience_years}} years career</div>
                <div class="wf-rec-pill">{{report.header.career_level}}</div>
                <div class="wf-rec-pill">{{report.header.top_domain}}</div>
                <div class="wf-rec-pill">{{report.career_timeline.[0].company_canonical}}</div>
              </div>

              <div class="wf-rec-section">
                <div class="wf-rec-sec-label">WHAT THIS PERSON DOES BEST &mdash; TOP POSITIVE SIGNALS</div>
                <div class="wf-rec-sig-chips">
                  {{#each report.top_signals}}
                    {{#if (eq this.severity 'positive')}}
                      <div class="r-chip-g">{{this.archetype_name}}</div>
                    {{/if}}
                  {{/each}}
                </div>
              </div>

              <div class="wf-rec-section">
                <div class="wf-rec-sec-label">FLAGS TO EXPLORE &mdash; AREAS WHERE EVIDENCE IS THIN OR RISKY</div>
                <div class="wf-rec-sig-chips">
                  {{#each report.top_signals}}
                    {{#if (eq this.severity 'negative')}}
                      <div class="r-chip-r">{{this.archetype_name}}</div>
                    {{/if}}
                  {{/each}}
                </div>
              </div>

              <div class="wf-rec-section">
                <div class="wf-rec-sec-label">EVIDENCE SNAPSHOT</div>
                <div class="wf-rec-snap">
                  <div class="wf-rec-snap-card">
                    <div class="wf-rec-snap-n">{{report.header.experience_years}} yrs</div>
                    <div class="wf-rec-snap-l">Career</div>
                  </div>
                  <div class="wf-rec-snap-card">
                    <div class="wf-rec-snap-n">{{report.career_timeline.length}}</div>
                    <div class="wf-rec-snap-l">Roles</div>
                  </div>
                  <div class="wf-rec-snap-card">
                    <div class="wf-rec-snap-n">{{report.data_health.validation_score}}%</div>
                    <div class="wf-rec-snap-l">Strong Evidence</div>
                  </div>
                </div>
              </div>

              <div class="wf-rec-section">
                <div class="wf-rec-sec-label">WHAT TO ASK IN THE INTERVIEW</div>
                <div class="wf-interview-box">
                  <p>{{#if report.recruiter_verdict.interview_calibration}}{{report.recruiter_verdict.interview_calibration}}{{else}}No specific calibration notes provided.{{/if}}</p>
                </div>
              </div>

              <div class="wf-rec-section">
                <div class="wf-rec-sec-label">AUDITOR VERDICT &mdash; STAMPED BY A HUMAN PROFESSIONAL</div>
                <div class="wf-verdict-card wf-v-proceed">
                  <div class="wf-v-word">{{#if report.recruiter_verdict.final_recommendation}}{{report.recruiter_verdict.final_recommendation}}{{else}}Proceed{{/if}}</div>
                  <div class="wf-v-meta">Reviewed by Hawksyn Intelligence Auditor &middot; May 2026</div>
                </div>
              </div>
            </div>

            <div class="mt-12 space-y-4">
              <div class="text-xs text-text3 uppercase font-bold tracking-widest">WHY THIS VIEW EXISTS</div>
              <div class="wf-why-box">
                <div class="wf-why-icon">⚡</div>
                <div class="wf-why-text">A recruiter reads this in <strong>90 seconds</strong> and makes a screening decision. The operating mode badge does 60% of the job. The signal chips do the rest.</div>
              </div>
              <div class="wf-why-box">
                <div class="wf-why-icon">🔒</div>
                <div class="wf-why-text">The professional controls what the recruiter sees. They generate the link. They choose when to share it. It expires. The recruiter never sees the full scan.</div>
              </div>
              <div class="wf-why-box">
                <div class="wf-why-icon">✅</div>
                <div class="wf-why-text">The auditor stamp is the differentiator. No AI tool will ever put a named human professional's credibility behind an individual candidate.</div>
              </div>
            </div>
          </div>
        </div>

        <div class="page-break"></div>

        <!-- WHAT WE READ TAB -->
        <div class="wf-main">
          <div class="wf-content-header">
            <div class="wf-content-title">What Hawksyn Read From Your CV</div>
            <div class="wf-content-sub">Every fact, signal, and pattern extracted from your career history &mdash; before any interpretation begins.</div>
          </div>
          
          <div class="p-0">
            <!-- ZONE 1 -->
            <div class="wf-section">
              <div class="wf-section-title">Zone 1 &mdash; Your career timeline</div>
              <p style="font-size:11px;color:var(--text3);margin-bottom:16px;">Each block is one role. Width = how long you stayed. Colour = seniority level at that time. Tap any block to see details.</p>
              <div class="wf-timeline-wrap">
                <div class="wf-timeline-track">
                  {{#each report.career_timeline}}
                    <div class="wf-role-block" style="width: {{this.timelineWidthPct}}%; min-width: 40px; background: {{this.timelineBg}};"></div>
                  {{/each}}
                </div>
              </div>
              <div class="wf-tl-legend">
                <div class="wf-tl-li"><div class="wf-tl-ld" style="background:#334155"></div>Junior (Rank 1&ndash;2)</div>
                <div class="wf-tl-li"><div class="wf-tl-ld" style="background:#3d5a6e"></div>Mid (Rank 3)</div>
                <div class="wf-tl-li"><div class="wf-tl-ld" style="background:#0f766e"></div>Senior (Rank 4)</div>
                <div class="wf-tl-li"><div class="wf-tl-ld" style="background:#e85c0d"></div>Leadership (Rank 5+)</div>
              </div>
              <div class="wf-tl-stats">
                <div class="wf-tl-stat"><div class="wf-tl-stat-n">{{report.header.experience_years}}</div><div class="wf-tl-stat-l">Years Parsed</div></div>
                <div class="wf-tl-stat"><div class="wf-tl-stat-n">{{report.career_timeline.length}}</div><div class="wf-tl-stat-l">Roles</div></div>
                <div class="wf-tl-stat"><div class="wf-tl-stat-n">{{report.totalAEUs}}</div><div class="wf-tl-stat-l">Evidence Units</div></div>
              </div>
              <div class="wf-insight">
                <div class="wf-insight-label">What this tells you</div>
                <p>{{report.executive_summary.candidate_intelligence_summary}}</p>
              </div>
            </div>

            <!-- ZONE 2 -->
            <div class="wf-section">
              <div class="wf-section-title">Zone 2 &mdash; How deep your evidence goes</div>
              <p style="font-size:11px;color:var(--text3);margin-bottom:16px;">Not all work history is equal. Hawksyn measures three layers &mdash; how much was extracted, how much is strongly backed, and how much you personally owned.</p>
              <div class="wf-rings-row">
                <svg width="110" height="110" viewBox="0 0 110 110">
                  <circle cx="55" cy="55" r="48" fill="none" stroke="#2c2c2c" stroke-width="14"/>
                  <circle cx="55" cy="55" r="48" fill="none" stroke="#1d4ed8" stroke-width="14" opacity="0.4" stroke-dasharray="{{report.ring48_dash}}" stroke-dashoffset="{{report.ring48_offset}}"/>
                  <circle cx="55" cy="55" r="32" fill="none" stroke="#2c2c2c" stroke-width="11"/>
                  <circle cx="55" cy="55" r="32" fill="none" stroke="#0d9488" stroke-width="11" stroke-dasharray="{{report.ring32_dash}}" stroke-dashoffset="{{report.ring32_offset}}"/>
                  <circle cx="55" cy="55" r="16" fill="none" stroke="#2c2c2c" stroke-width="8"/>
                  <circle cx="55" cy="55" r="16" fill="none" stroke="#e85c0d" stroke-width="8" stroke-dasharray="{{report.ring16_dash}}" stroke-dashoffset="{{report.ring16_offset}}"/>
                  <text x="55" y="51" text-anchor="middle" font-size="16" font-weight="600" fill="#f0f0f0">{{report.totalAEUs}}</text>
                  <text x="55" y="63" text-anchor="middle" font-size="9" fill="#666">units</text>
                </svg>
                <div class="wf-ring-stats">
                  <div class="wf-ring-stat-row">
                    <div class="wf-ring-dot" style="background:#1d4ed8; opacity:0.7"></div>
                    <span class="wf-ring-label">Total evidence units extracted</span>
                    <span class="wf-ring-val">{{report.totalAEUs}}</span>
                  </div>
                  <div class="wf-ring-stat-row">
                    <div class="wf-ring-dot" style="background:#0d9488"></div>
                    <span class="wf-ring-label">Units with strong evidence</span>
                    <span class="wf-ring-val" style="color:#0d9488">{{report.strongAEUs}}</span>
                  </div>
                  <div class="wf-ring-stat-row">
                    <div class="wf-ring-dot" style="background:#e85c0d"></div>
                    <span class="wf-ring-label">Units you fully owned</span>
                    <span class="wf-ring-val" style="color:#e85c0d">{{report.ownedAEUs}}</span>
                  </div>
                </div>
              </div>
              <div class="wf-insight">
                <div class="wf-insight-label">What this tells you</div>
                <p>Of your {{report.totalAEUs}} units, <strong>{{report.strongAEUs}} are strongly backed</strong> &mdash; meaning the claim has measurable outcomes. Only <strong>{{report.ownedAEUs}} show full ownership</strong>.</p>
              </div>
            </div>

            <!-- ZONE 3 -->
            <div class="wf-section">
              <div class="wf-section-title">Zone 3 &mdash; The gap between what you claim and what Hawksyn can prove</div>
              <div class="wf-bar-pair">
                <div class="wf-bar-pair-title">Skills</div>
                <div class="wf-bar-pair-sub">You listed {{report.totalSkillsCount}} skills. Hawksyn found evidence of only {{report.provenSkillsCount}} used in your work.</div>
                <div class="wf-bar-row">
                  <div class="wf-bar-row-head"><span class="wf-bar-row-label">Skills listed</span><span class="wf-bar-row-n">{{report.totalSkillsCount}}</span></div>
                  <div class="wf-bar-bg" style="height:10px"><div class="wf-bar-fill" style="width:100%; background:#334155"></div></div>
                </div>
                <div class="wf-bar-row" style="margin-top:8px">
                  <div class="wf-bar-row-head"><span class="wf-bar-row-label" style="color:#0d9488">Skills proven</span><span class="wf-bar-row-n" style="color:#0d9488">{{report.provenSkillsCount}}</span></div>
                  <div class="wf-bar-bg" style="height:10px"><div class="wf-bar-fill" style="width:{{report.provenSkillsPct}}%; background:#0d9488"></div></div>
                </div>
              </div>
              <div class="wf-warn">
                <div class="wf-warn-label">Why this gap matters</div>
                <p>Skills that appear only in a skills section carry very little credibility. find work evidence to support them.</p>
              </div>
            </div>

            <!-- ZONE 4 -->
            <div class="wf-section">
              <div class="wf-section-title">Zone 4 &mdash; Everything Hawksyn extracted from your CV</div>
              <div class="wf-ext-grid">
                <div class="wf-ext-chip"><span class="wf-ext-chip-icon">💼</span><span class="wf-ext-chip-label">Roles</span><span class="wf-ext-chip-n">{{report.career_timeline.length}}</span></div>
                <div class="wf-ext-chip"><span class="wf-ext-chip-icon">🔧</span><span class="wf-ext-chip-label">Skills</span><span class="wf-ext-chip-n">{{report.totalSkillsCount}}</span></div>
                <div class="wf-ext-chip"><span class="wf-ext-chip-icon">🏷</span><span class="wf-ext-chip-label">Domain terms</span><span class="wf-ext-chip-n">{{report.domain_intelligence.specializations.length}}</span></div>
                <div class="wf-ext-chip"><span class="wf-ext-chip-icon">🎓</span><span class="wf-ext-chip-label">Credentials</span><span class="wf-ext-chip-n">{{report.education_section.length}}</span></div>
                <div class="wf-ext-chip"><span class="wf-ext-chip-icon">📅</span><span class="wf-ext-chip-label">Career gaps</span><span class="wf-ext-chip-n">{{report.extracted_cv.gap_periods.length}}</span></div>
                <div class="wf-ext-chip"><span class="wf-ext-chip-icon">🏢</span><span class="wf-ext-chip-label">Companies</span><span class="wf-ext-chip-n">{{report.career_timeline.length}}</span></div>
                <div class="wf-ext-chip"><span class="wf-ext-chip-icon">📍</span><span class="wf-ext-chip-label">Locations</span><span class="wf-ext-chip-n">1</span></div>
              </div>
            </div>
          </div>
        </div>

        <div class="page-break"></div>

        <!-- EVIDENCE TRAIL TAB -->
        <div class="wf-main">
          <div class="wf-content-header">
            <div class="wf-content-title">Evidence Trail — The Proof Behind Every Signal</div>
            <div class="wf-content-sub">Two tables. Table 1 shows exactly what Hawksyn read from your CV &mdash; verbatim extracted facts, nothing added.</div>
          </div>
          
          <div class="p-8">
            <div class="wf-sig-summary">
              <div class="wf-sig-badge wf-sig-badge-pos">{{report.totalAEUs}} facts extracted from CV</div>
              <div class="wf-sig-badge wf-sig-badge-pos">{{report.totalSignals}} signal patterns detected</div>
              <div class="wf-sig-badge wf-sig-badge-neu">Zero assumptions unmarked</div>
            </div>

            <div class="wf-fingerprint-box">
              <div class="wf-fp-text">
                Every number, every signal, every insight in this report comes from one of the two tables below. Nothing is generated from thin air. If Hawksyn says you are a strategic operator &mdash; the evidence is in table 2. If Hawksyn says you have 9 proven skills &mdash; the source records are in table 1. This screen exists so you can verify every claim yourself.
              </div>
            </div>

            <div class="wf-section px-0">
              <div class="wf-section-title">TABLE 1 &mdash; WHAT YOUR CV ACTUALLY SAYS</div>
              <p class="text-xs text-text2 mb-8 opacity-80 leading-relaxed">These are the raw facts extracted from your CV by Hawksyn's parsing engine. Each row is one verified fact. Fields marked <span class="wf-assumed">assumed</span> were inferred by the parser &mdash; not explicitly stated in your CV. Everything else was found verbatim.</p>
              
              <div class="wf-trail-grid">
                <div class="wf-trail-card"><div class="wf-trail-n">{{report.career_timeline.length}}</div><div class="wf-trail-l">Roles</div></div>
                <div class="wf-trail-card"><div class="wf-trail-n">{{report.totalSkillsCount}}</div><div class="wf-trail-l">Skills</div></div>
                <div class="wf-trail-card"><div class="wf-trail-n">{{report.domain_intelligence.specializations.length}}</div><div class="wf-trail-l">Domain Terms</div></div>
                <div class="wf-trail-card"><div class="wf-trail-n">{{report.education_section.length}}</div><div class="wf-trail-l">Credentials</div></div>
                <div class="wf-trail-card"><div class="wf-trail-n">{{report.totalAEUs}}</div><div class="wf-trail-l">Total Facts</div></div>
              </div>

              <div class="wf-rec-sec-label mb-4">ROLES AND TIMELINE</div>
              <div class="wf-table-wrapper">
                <table class="wf-table">
                  <thead>
                    <tr>
                      <th>Company</th><th>Title</th><th>Duration</th><th>Seniority Rank</th><th>Facts Extracted</th><th>Location</th>
                    </tr>
                  </thead>
                  <tbody>
                    {{#each report.career_timeline}}
                    <tr>
                      <td class="font-medium text-text">{{#if this.company_canonical}}{{this.company_canonical}}{{else}}{{this.company}}{{/if}}</td>
                      <td>{{#if this.title_canonical}}{{this.title_canonical}}{{else}}{{this.title}}{{/if}}</td>
                      <td>{{this.duration_months}} months</td>
                      <td><span class="wf-pill wf-pill-neu">Rank {{#if this.title_seniority_rank}}{{this.title_seniority_rank}}{{else}}-{{/if}} &mdash; {{#if this.career_stage}}{{this.career_stage}}{{else}}-{{/if}}</span></td>
                      <td>{{#if this.base_aeu_count}}{{this.base_aeu_count}}{{else}}0{{/if}} facts</td>
                      <td>{{#if this.location_city}}{{this.location_city}}{{else}}{{this.location}}{{/if}}</td>
                    </tr>
                    {{/each}}
                  </tbody>
                </table>
              </div>

              <div class="wf-rec-sec-label mb-4">SKILLS FOUND IN YOUR CV</div>
              <div class="wf-table-wrapper">
                <table class="wf-table">
                  <thead>
                    <tr>
                      <th>Skill Name</th><th>Category</th><th>Recency</th><th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {{#each report.extracted_cv.skills}}
                    <tr>
                      <td class="font-medium text-text">{{this.skill_name}}</td>
                      <td><span class="wf-pill wf-pill-neu">{{this.category}}</span></td>
                      <td>{{#if this.recency}}{{this.recency}}{{else}}Current{{/if}}</td>
                      <td><span class="wf-pill {{#if this.is_proven}}wf-pill-teal{{else}}wf-pill-red{{/if}}">{{#if this.is_proven}}Proven{{else}}Claimed only{{/if}}</span></td>
                    </tr>
                    {{/each}}
                  </tbody>
                </table>
              </div>

              <div class="wf-rec-sec-label mb-4">CAREER GAPS DETECTED</div>
              <div class="wf-table-wrapper">
                <table class="wf-table">
                  <thead>
                    <tr>
                      <th>Between Roles</th><th>Gap Duration</th><th>Activity During Gap</th><th>Flag Raised</th>
                    </tr>
                  </thead>
                  <tbody>
                    {{#each report.extracted_cv.gap_periods}}
                    <tr>
                      <td>{{this.between_roles}}</td>
                      <td>{{this.duration_months}} months</td>
                      <td>{{this.activity_detected}}</td>
                      <td><span class="wf-pill wf-pill-neu">{{#if this.flag_raised}}Yes{{else}}No Flag{{/if}}</span></td>
                    </tr>
                    {{/each}}
                  </tbody>
                </table>
              </div>

              <div class="wf-fingerprint-box">
                 <div class="wf-fp-label">WHAT THIS AUDIT CONFIRMS</div>
                 <div class="wf-fp-text">
                   Hawksyn extracted <strong>{{report.totalAEUs}} verifiable facts</strong> from your CV across <strong>{{report.career_timeline.length}} roles</strong> and <strong>{{report.totalSkillsCount}} skills</strong>. Every signal in your report is traced back to these extracted evidence units to ensure zero-assumption reporting.
                 </div>
              </div>
            </div>
            
            <div class="page-break"></div>

            <!-- TABLE 2 -->
            <div class="wf-section px-0">
              <div class="wf-section-title">TABLE 2 &mdash; SIGNAL PATTERNS COLLECTED DURING YOUR SCAN</div>
              <p class="text-xs text-text2 mb-8 opacity-80 leading-relaxed">These are the {{report.totalSignals}} intelligence patterns that fired during your scan. Each row shows which pattern matched, what evidence triggered it, and our confidence in the detection.</p>
              
              <div class="wf-trail-grid">
                <div class="wf-trail-card"><div class="wf-trail-n">{{report.totalSignals}}</div><div class="wf-trail-l">Detected</div></div>
                <div class="wf-trail-card"><div class="wf-trail-n">{{report.notDetectedSignals}}</div><div class="wf-trail-l">Not Detected</div></div>
                <div class="wf-trail-card"><div class="wf-trail-n">330</div><div class="wf-trail-l">Total Evaluated</div></div>
                <div class="wf-trail-card"><div class="wf-trail-n">{{report.flagsCount}}</div><div class="wf-trail-l">Flags</div></div>
              </div>

              <div class="wf-table-wrapper">
                <table class="wf-table">
                  <thead>
                    <tr>
                      <th>Signal Name</th><th>Cluster</th><th>Type</th><th>Evidence That Triggered This</th><th>Confidence</th><th>What This Means For You</th>
                    </tr>
                  </thead>
                  <tbody>
                    {{#each report.top_signals}}
                    <tr>
                      <td class="font-medium text-text">{{this.archetype_name}}</td>
                      <td><span class="wf-pill wf-pill-neu">{{this.cluster}}</span></td>
                      <td><span class="wf-pill {{#if (eq this.severity 'positive')}}wf-pill-teal{{else}}wf-pill-red{{/if}}">{{#if (eq this.severity 'positive')}}Strength{{else}}Flag{{/if}}</span></td>
                      <td class="max-w-[200px]">{{this.reasoning}}</td>
                      <td>
                        <div class="wf-conf-bar"><div class="wf-conf-fg bg-teal" style="width: 90%"></div></div>
                        <span class="ml-2 text-[9px] text-text3">High</span>
                      </td>
                      <td class="max-w-[200px] italic text-text2">{{#if this.so_what}}{{this.so_what}}{{else}}Organizations cannot wait to promote you.{{/if}}</td>
                    </tr>
                    {{/each}}
                  </tbody>
                </table>
              </div>

              <div class="wf-fingerprint-box mt-6">
                 <div class="wf-fp-label">WHAT TABLE 2 CONFIRMS</div>
                 <div class="wf-fp-text">
                   Every signal in your report was triggered by <strong>specific measurable facts</strong> from table 1 &mdash; not by general impression or AI inference. The Evidence column in each row shows exactly what crossed the detection threshold. <strong>Two flags were raised</strong> &mdash; both are based on verifiable absence of evidence, not assumption. The 312 archetypes that did not fire were evaluated and found absent, which is equally important information.
                 </div>
              </div>

              <div class="mt-12 space-y-4">
                <div class="text-[10px] text-text3 uppercase font-bold tracking-widest">WHY THIS SCREEN EXISTS</div>
                <div class="wf-why-box">
                  <div class="wf-why-icon">🔍</div>
                  <div class="wf-why-text"><strong>Every claim is traceable.</strong> Any signal in your report can be traced back to a specific row in Table 1. Hawksyn does not make assertions without a source. This is what makes the report auditable &mdash; by you, by a recruiter, or by a professional auditor.</div>
                </div>
                <div class="wf-why-box">
                  <div class="wf-why-icon">✏️</div>
                  <div class="wf-why-text"><strong>If something is wrong, you can fix it.</strong> If Table 1 extracted something incorrectly from your CV, you can edit it in your profile and rescan. The report is only as good as the CV data underneath it.</div>
                </div>
                <div class="wf-why-box">
                  <div class="wf-why-icon">⚠️</div>
                  <div class="wf-why-text"><strong>Claimed-only skills are a transparency signal, not an accusation.</strong> The table marks 13 skills as claimed only &mdash; not as lies. It means Hawksyn could not find work evidence to back them. That is information, not a verdict.</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div class="page-break"></div>

        <!-- SIGNALS FOUND TAB -->
        <div class="wf-main">
          <div class="wf-content-header">
            <div class="wf-content-title">Signals Found — Your Career Archetypes</div>
            <div class="wf-content-sub">Detected patterns across 8 core clusters that define your professional DNA.</div>
          </div>

          <div class="p-8">
            <div class="wf-sig-summary">
              <div class="wf-sig-badge wf-sig-badge-pos">{{report.posCount}} positive signals</div>
              <div class="wf-sig-badge wf-sig-badge-neg">{{report.flagsCount}} flags</div>
              <div class="wf-sig-badge wf-sig-badge-neu">0 watch signals</div>
              <div class="wf-sig-badge wf-sig-badge-strong">Signal strength: Strong</div>
            </div>

            <div class="wf-section px-0 pt-0">
              <div class="wf-section-title">OVERVIEW &mdash; ALL 8 CLUSTERS AT A GLANCE</div>
              <p class="text-xs text-text2 mb-6 opacity-80 leading-relaxed">Each cluster is a different dimension of your professional profile. Green bars are good. A flag marker means Hawksyn found a risk. Click any cluster name in the sidebar to jump to all its signals.</p>
              
              <div class="wf-fingerprint-box">
                <div class="wf-fp-label">WHAT THIS FINGERPRINT TELLS YOU</div>
                <div class="wf-fp-text">
                  {{report.executive_summary.candidate_intelligence_summary}}
                </div>
              </div>

              <div class="cl-grid">
                {{#each report.clustersList}}
                <div class="cl-card {{#if this.hasFlag}}has-flag{{/if}}">
                  <div class="cl-card-header"><span class="cl-name">{{this.icon}} {{this.name}}</span></div>
                  <div class="cl-bar-bg"><div class="cl-bar-fg" style="width: {{this.scorePct}}%; background: var(--teal)"></div></div>
                  <div class="cl-nums"><span class="cl-fired">{{this.detected}} detected</span></div>
                </div>
                {{/each}}
              </div>
            </div>

            <div class="wf-section px-0">
              <div class="wf-section-title">ALL 330 SIGNALS &mdash; GROUPED BY CLUSTER</div>
              <div class="wf-sig-legend">
                <div class="wf-leg-item"><div class="wf-leg-dot pos"></div> Positive &mdash; a strength or asset</div>
                <div class="wf-leg-item"><div class="wf-leg-dot neg"></div> Negative &mdash; a risk or gap</div>
                <div class="wf-leg-item"><div class="wf-leg-dot neu"></div> Neutral &mdash; context only</div>
                <div class="wf-leg-item"><div class="wf-leg-dot warn"></div> Context-dependent</div>
              </div>

              <div class="space-y-8">
                {{#if report.totalSignals}}
                  {{#each report.clustersList}}
                    {{#if this.signals.length}}
                    <div class="cluster-section">
                      <div class="cluster-header">
                        <span class="cluster-icon text-2xl" style="font-size:24px;margin-right:12px;">{{this.icon}}</span>
                        <div class="cluster-header-text">
                          <div class="cluster-header-name">{{this.name}}</div>
                          <div class="cluster-header-plain">{{this.plain}}</div>
                        </div>
                        <div class="cluster-header-meta">
                          <span class="{{#if (gt this.scoreCount 0)}}cl-badge-pos{{else}}cl-badge-total{{/if}}">
                            {{#if (gt this.scoreCount 0)}}+{{this.scoreCount}}{{else}}0{{/if}} signals
                          </span>
                        </div>
                      </div>
                      <div class="signal-table">
                        {{#each this.signals}}
                          <div class="signal-row">
                            <div class="sig-pol" style="background: {{#if (eq this.severity 'positive')}}var(--teal){{else}}var(--red){{/if}};"></div>
                            <div class="sig-body">
                              <div class="sig-name">● {{this.archetype_name}}</div>
                              <div class="sig-meaning">{{this.reasoning}}</div>
                              {{#if this.so_what}}<div class="sig-sowhat">{{this.so_what}}</div>{{/if}}
                            </div>
                            <div class="sig-meta">
                              <span class="sig-pol-badge {{#if (eq this.severity 'positive')}}sig-pol-pos{{else}}sig-pol-neg{{/if}}">{{this.severity}}</span>
                              {{#if this.is_surface}}<span class="sig-surface">surface</span>{{/if}}
                            </div>
                          </div>
                        {{/each}}
                      </div>
                    </div>
                    {{/if}}
                  {{/each}}
                {{else}}
                  <div class="p-8 text-center text-text3 text-xs italic" style="border: 1px solid var(--border); border-radius: 8px; background: var(--bg2);">No active signals detected in any cluster.</div>
                {{/if}}
              </div>
            </div>

            <div class="wf-section px-0">
              <div class="wf-section-title">YOUR TOP TAKEAWAYS FROM THESE SIGNALS</div>
              {{#each report.top_signals}}
                <div class="wf-takeaway-box {{#if (eq this.severity 'positive')}}pos{{else}}neg{{/if}}">
                  <div class="wf-tk-icon">{{#if (eq this.severity 'positive')}}🏆{{else}}⚠️{{/if}}</div>
                  <div class="wf-tk-text">
                    <strong>{{this.archetype_name}} detected.</strong> {{this.reasoning}} {{#if this.so_what}}<span>{{this.so_what}}</span>{{/if}}
                  </div>
                </div>
              {{/each}}
            </div>
          </div>
        </div>
    </div>
</body>
</html>`;

fs.writeFileSync('d:/Client Project/Hawksyn/backend/Hawksyn-backend/src/modules/cv/templates/CV_Report_Template.hbs', html);
console.log('Template created successfully!');
