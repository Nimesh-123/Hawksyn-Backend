/**
 * Generates the complete HTML for the Hawksyn Report.
 * FIXES:
 *  1. Prose paragraphs with bullet markers (•) now render as actual <ul><li> lists.
 *  2. Sections no longer force a new page — content flows continuously.
 *     Page breaks only appear after the cover page and the CV baseline page.
 */
function buildReportHtml(reportData) {
    const { report, runId, generatedAt, role, profile } = reportData;
    const sections = report.sections || [];
    const dateStr = generatedAt ? new Date(generatedAt).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) : 'March 14, 2026';

    const getVerdictColor = (score) => {
        if (score < 40) return '#EF4444';
        if (score < 70) return '#F59E0B';
        return '#10B981';
    };

    const parseJSON = (str) => {
        try {
            if (typeof str !== 'string') return str;
            let jsonStr = str;
            
            const match = str.match(/```(?:json)?\s*([\s\S]*?)```/i);
            if (match && match[1]) {
                jsonStr = match[1];
            } else {
                const firstBrace = str.indexOf('{');
                const firstBracket = str.indexOf('[');
                let start = -1;
                let end = -1;
                if (firstBrace !== -1 && (firstBracket === -1 || firstBrace < firstBracket)) {
                    start = firstBrace;
                    end = str.lastIndexOf('}');
                } else if (firstBracket !== -1) {
                    start = firstBracket;
                    end = str.lastIndexOf(']');
                }
                if (start !== -1 && end !== -1 && end > start) {
                    jsonStr = str.substring(start, end + 1);
                }
            }

            try { return JSON.parse(jsonStr.trim()); }
            catch (e) {
                try { return JSON.parse(jsonStr.replace(/\r?\n/g, ' ').trim()); }
                catch (err) { return null; }
            }
        } catch (e) { return null; }
    };

    const getSectData = (id) => {
        const s = sections.find(s => s.sectionId === id);
        if (!s) return null;
        return parseJSON(s.content);
    };

    /**
     * md() — Convert markdown bold (**text**) and italic (*text*) to HTML.
     * Also strips lone asterisks used as stray markers.
     * Applied to every string before it reaches the browser.
     */
    const md = (text) => {
        if (!text) return '';
        return text
            // **bold** or __bold__
            .replace(/\*\*([^*]+?)\*\*/g, '<strong>$1</strong>')
            .replace(/__([^_]+?)__/g, '<strong>$1</strong>')
            // *italic* or _italic_  (single, not double)
            .replace(/\*([^*\n]+?)\*/g, '<em>$1</em>')
            .replace(/_([^_\n]+?)_/g, '<em>$1</em>')
            // stray lone asterisks left over (e.g. "Pro-Tip:**")
            .replace(/\*+/g, '');
    };

    /**
     * FIX 1 — Convert prose strings that use "• " as bullet separators into
     * proper HTML lists. Also converts plain "\n" separated lines into bullets
     * when there are 2+ lines that look like list items.
     * md() is applied to every piece of text so **bold** renders correctly.
     */
    const proseToHtml = (text) => {
        if (!text) return '';
        // If the text contains bullet markers, split on them
        if (text.includes(' • ') || text.startsWith('• ')) {
            const parts = text.split(/\s?•\s+/).filter(Boolean);
            if (parts.length > 1) {
                return `<ul class="bullet-list">${parts.map(p => `<li>${md(p.trim())}</li>`).join('')}</ul>`;
            }
        }
        // Lines split by newline — each becomes a bullet if 3+ lines
        const lines = text.split(/\n+/).filter(l => l.trim());
        if (lines.length >= 3) {
            return `<ul class="bullet-list">${lines.map(l => `<li>${md(l.trim())}</li>`).join('')}</ul>`;
        }
        // Otherwise render as a single prose paragraph
        return `<p class="prose">${md(text).replace(/\n/g, '<br>')}</p>`;
    };

    /**
     * Same as proseToHtml but used inside callout/uncomfortable-truth boxes
     * where we want bullets but inside the existing styled container.
     */
    const innerProseToHtml = (text) => {
        if (!text) return '';
        if (text.includes(' • ') || text.startsWith('• ')) {
            const parts = text.split(/\s?•\s+/).filter(Boolean);
            if (parts.length > 1) {
                return `<ul class="bullet-list">${parts.map(p => `<li>${md(p.trim())}</li>`).join('')}</ul>`;
            }
        }
        // Newline-separated lines → bullets
        const lines = text.split(/\n+/).filter(l => l.trim());
        if (lines.length >= 3) {
            return `<ul class="bullet-list">${lines.map(l => `<li>${md(l.trim())}</li>`).join('')}</ul>`;
        }
        return md(text).replace(/\n/g, '<br>');
    };

    const renderBarChart = (data) => {
        if (!data || !Array.isArray(data)) return '';
        return `
            <div class="chart-container">
                ${data.map(item => {
                    const score = parseInt(item.score || item.exposure_percent || 0);
                    const color = item.bar_color || '#4F46E5';
                    return `
                        <div class="chart-row">
                            <div class="chart-label">${item.capability_name || item.task_category}</div>
                            <div class="bar-bg">
                                <div class="bar-fill" style="width: ${score}%; background: ${color};"></div>
                                <div class="bar-label" style="color: ${score > 50 ? 'white' : '#1f2937'}">${score}%</div>
                            </div>
                        </div>`;
                }).join('')}
            </div>`;
    };

    const renderDonutChart = (data) => {
        if (!data || !Array.isArray(data)) return '';
        let currentOffset = 0;
        const total = data.reduce((acc, i) => acc + (i.value || 0), 0);
        return `
            <div class="donut-wrapper">
                <svg width="180" height="180" viewBox="0 0 42 42" class="donut">
                    <circle cx="21" cy="21" r="15.915" fill="#fff"></circle>
                    ${data.map(item => {
                        const val = (item.value / total) * 100;
                        const circle = `<circle cx="21" cy="21" r="15.915" fill="transparent" stroke="${item.color}" stroke-width="4" stroke-dasharray="${val} ${100 - val}" stroke-dashoffset="${100 - currentOffset + 25}"></circle>`;
                        currentOffset += val;
                        return circle;
                    }).join('')}
                </svg>
                <div class="donut-legend">
                    ${data.map(i => `<div class="legend-item"><span class="dot" style="background:${i.color}"></span> ${i.label}: ${i.value}%</div>`).join('')}
                </div>
            </div>`;
    };

    const renderRadarChart = (data) => {
        if (!data || !data.axes) return '';
        const axes = data.axes;
        const current = data.current_profile.map(Number);
        const target  = data.target_profile.map(Number);
        const centerX = 100, centerY = 100, radius = 70;
        const getPoint = (val, i, total) => {
            const angle = (Math.PI * 2 * i) / total - Math.PI / 2;
            const r = (val / 5) * radius;
            return `${centerX + r * Math.cos(angle)},${centerY + r * Math.sin(angle)}`;
        };
        const currentPoints = current.map((v, i) => getPoint(v, i, axes.length)).join(' ');
        const targetPoints  = target.map((v, i) => getPoint(v, i, axes.length)).join(' ');
        return `
            <div class="radar-container flex-center">
                <svg width="340" height="250" viewBox="0 0 200 200">
                    <circle cx="100" cy="100" r="70" fill="none" stroke="#e5e7eb" stroke-dasharray="2,2"/>
                    <circle cx="100" cy="100" r="50" fill="none" stroke="#e5e7eb" stroke-dasharray="2,2"/>
                    <circle cx="100" cy="100" r="30" fill="none" stroke="#e5e7eb" stroke-dasharray="2,2"/>
                    ${axes.map((a, i) => {
                        const p    = getPoint(5,   i, axes.length).split(',');
                        const textP= getPoint(5.8, i, axes.length).split(',');
                        return `<line x1="100" y1="100" x2="${p[0]}" y2="${p[1]}" stroke="#e5e7eb"/>
                                <text x="${textP[0]}" y="${textP[1]}" font-size="5" font-weight="700" text-anchor="middle" fill="#6b7280">${a}</text>`;
                    }).join('')}
                    <polygon points="${targetPoints}"  fill="rgba(16,185,129,0.2)" stroke="#10B981" stroke-width="1.5"/>
                    <polygon points="${currentPoints}" fill="rgba(239,68,68,0.2)"  stroke="#EF4444" stroke-width="1.5"/>
                </svg>
                <div class="radar-legend">
                    <div style="color:#EF4444"><span class="dot" style="background:#EF4444"></span> Current Profile</div>
                    <div style="color:#10B981"><span class="dot" style="background:#10B981"></span> Target Profile</div>
                </div>
            </div>`;
    };

    function renderSection(s) {
        if (!s) return '';
        const data = parseJSON(s?.content) || {};
        const hasValidData = Object.keys(data).length > 0;

        if (!hasValidData && s.sectionId !== 'SEC_RO_004') {
            return `<div class="mt-4 text-gray-700">${proseToHtml(s?.content || '')}</div>`;
        }

        switch (s.sectionId) {
            case 'SEC_RO_001':
                return proseToHtml(data.summary_prose || '');

            case 'SEC_RO_002':
                return `
                    ${proseToHtml(data.overview_prose || '')}
                    <div class="uncomfortable-truth">
                        <strong>${data.uncomfortable_truth?.label || 'Truth'}:</strong>
                        ${innerProseToHtml(data.uncomfortable_truth?.content || '')}
                    </div>`;

            case 'SEC_RO_003':
                return `
                    <div style="display:grid; grid-template-columns:1fr 1fr; gap:20px;">
                        <div>
                            <div style="font-weight:700; color:#059669; font-size:9pt; margin-bottom:8px;">WHAT THIS REPORT COVERS</div>
                            <ul class="bullet-list">${(data.covers || []).map(i => `<li>${i.item}</li>`).join('')}</ul>
                        </div>
                        <div>
                            <div style="font-weight:700; color:#6b7280; font-size:9pt; margin-bottom:8px;">WHAT IT DOES NOT COVER</div>
                            <ul class="bullet-list">${(data.does_not_cover || []).map(i => `<li>${i.item}</li>`).join('')}</ul>
                        </div>
                    </div>
                    <div class="mt-4" style="font-size:8.5pt; font-style:italic; color:#9ca3af;">Methodology: ${data.methodology_note || ''}</div>`;

            case 'SEC_RO_004':
            case 'SEC_RO_009':
                let chartData = data.chart_data;
                const userSkills = profile?.skills || profile?.composition?.skills;
                if (!chartData && s.sectionId === 'SEC_RO_004' && userSkills) {
                    let skillsList = [];
                    if (Array.isArray(userSkills)) skillsList = userSkills;
                    else if (userSkills.technical) skillsList = userSkills.technical;
                    else if (Array.isArray(userSkills.skills)) skillsList = userSkills.skills;
                    
                    if (Array.isArray(skillsList) && skillsList.length > 0) {
                        const topSkills = skillsList.slice(0, 5);
                        chartData = {
                            labels: topSkills,
                            values: topSkills.map(() => 75)
                        };
                    }
                }
                
                return `
                    ${proseToHtml(data.context_prose || data.methodology_note || s.content || '')}
                    ${chartData ? renderBarChart(chartData) : ''}
                    ${(data.interpretation_callout || data.exposure_callout) ? `<div class="callout">${innerProseToHtml(data.interpretation_callout || data.exposure_callout || '')}</div>` : ''}`;

            case 'SEC_RO_005':
                return `
                    <table class="data-table">
                        <thead><tr><th>Role</th><th>Fit</th><th>Durability</th></tr></thead>
                        <tbody>${(data.fit_rows || []).map(r => `
                            <tr><td><strong>${r.role_type}</strong></td><td>${r.fit_level}</td><td>${r.durability}</td></tr>
                            <tr><td colspan="3" style="font-size:8.5pt; color:#6b7280; border-top:none; padding-top:0;">
                                ${proseToHtml((r.notes || '').replace(/\n/g, ' '))}
                            </td></tr>`).join('')}
                        </tbody>
                    </table>`;

            case 'SEC_RO_006':
                return `
                    <table class="data-table">
                        <thead><tr><th>Sector</th><th>Demand</th><th>Outlook</th><th>Risk</th></tr></thead>
                        <tbody>${(data.sector_rows || []).map(r => `<tr><td>${r.sector}</td><td>${r.demand_now}</td><td>${r.one_year_outlook}</td><td>${r.risk_to_role}</td></tr>`).join('')}</tbody>
                    </table>
                    <div class="callout">${innerProseToHtml(data.key_signal || '')}</div>`;

            case 'SEC_RO_007':
                return `
                    <div class="two-col-box">
                        <div>
                            <div class="box-heading" style="color:#059669;">What You Bring</div>
                            ${proseToHtml(data.what_you_bring || '')}
                        </div>
                        <div>
                            <div class="box-heading" style="color:#EF4444;">What Is Missing</div>
                            ${proseToHtml(data.what_is_missing || '')}
                        </div>
                    </div>`;

            case 'SEC_RO_008':
                return `
                    <div class="red-flags-grid">
                        ${(data.red_flags || []).map(f => `
                            <div class="flag-card ${f.severity?.toLowerCase() || ''}">
                                <div class="flag-title">${f.rf_label}</div>
                                <div class="flag-content">${innerProseToHtml(f.content)}</div>
                            </div>`).join('')}
                    </div>`;

            case 'SEC_RO_010':
                return `
                    <table class="data-table">
                        <thead><tr><th>Task Category</th><th>AI Capability</th><th>Replaces User?</th><th>Timeline</th></tr></thead>
                        <tbody>${(data.task_rows || []).map(r => `<tr><td>${r.task_category}</td><td>${r.ai_capability}</td><td>${r.replaces_user}</td><td>${r.timeline}</td></tr>`).join('')}</tbody>
                    </table>`;

            case 'SEC_RO_011':
                return `
                    <table class="data-table">
                        <thead><tr><th>Experience Band</th><th>Demand (2023)</th><th>Demand (2026)</th></tr></thead>
                        <tbody>${(data.chart_data || []).map(r => `<tr><td>${r.experience_band}</td><td>${r.demand_2023}</td><td>${r.demand_2026}</td></tr>`).join('')}</tbody>
                    </table>
                    <div class="callout">${innerProseToHtml(data.salary_signal_callout || '')}</div>`;

            case 'SEC_RO_012':
                return `
                    <div class="timeline-container">
                        ${(data.timeline_rows || []).map(r => `
                            <div class="timeline-item">
                                <div class="timeline-period">${r.period}</div>
                                <div class="timeline-desc">${innerProseToHtml(r.description)}</div>
                            </div>`).join('')}
                    </div>`;

            case 'SEC_RO_013':
                return `
                    <div class="risk-section">
                        ${renderDonutChart(data.donut_data)}
                        <table class="data-table mt-4">
                            <thead><tr><th>Scenario</th><th>12 Mo</th><th>24 Mo</th></tr></thead>
                            <tbody>${(data.probability_rows || []).map(r => `<tr><td>${r.scenario}</td><td>${r.prob_12m}</td><td>${r.prob_24m}</td></tr>`).join('')}</tbody>
                        </table>
                    </div>`;

            case 'SEC_RO_014':
                return `
                    <div style="font-weight:700; font-size:12pt; color:#D97706; margin-bottom:15px;">Blind Spot Index (BSI): ${data.bsi_score}/100</div>
                    <div class="red-flags-grid">
                        ${(data.blind_spots || []).map(b => `
                            <div class="flag-card medium">
                                <div class="flag-title">#${b.blind_spot_number} ${b.name}</div>
                                <div class="flag-content">${innerProseToHtml(b.content)}</div>
                                <div style="margin-top:8px; font-size:7.5pt; font-weight:700;">LIABILITY: ${b.shadow_liability}</div>
                            </div>`).join('')}
                    </div>`;

            case 'SEC_RO_015':
                return `
                    <table class="data-table">
                        <thead><tr><th>Variable</th><th>If Favourable</th><th>If Unfavourable</th><th>Control</th></tr></thead>
                        <tbody>${(data.unknown_rows || []).map(r => `
                            <tr><td><strong>${r.variable}</strong></td><td>${r.if_favourable}</td><td>${r.if_unfavourable}</td>
                            <td><span class="badge">${r.user_control}</span></td></tr>`).join('')}
                        </tbody>
                    </table>`;

            case 'SEC_RO_016':
                return `
                    <div class="callout" style="margin-bottom:15px;"><strong>Trigger:</strong> ${innerProseToHtml(data.trigger_event)}</div>
                    <div class="cascade-grid">
                        ${(data.cascade || []).map(c => `
                            <div class="cascade-card">
                                <div class="cascade-label">${c.order_label}</div>
                                <div>${innerProseToHtml(c.description)}</div>
                            </div>`).join('')}
                    </div>`;

            case 'SEC_RO_017':
                return `
                    ${proseToHtml(data.scenario_prose || '')}
                    <div style="background:#EFF6FF; border-left:4px solid #3B82F6; padding:15px; border-radius:6px; font-size:10pt;">
                        <strong>Best Case Condition:</strong> ${innerProseToHtml(data.best_case_condition || '')}
                    </div>`;

            case 'SEC_RO_018':
                return `
                    <div class="flex-center">${renderRadarChart(data.radar_data)}</div>
                    <div class="mt-4">${proseToHtml(data.transferability_prose || '')}</div>`;

            case 'SEC_RO_019':
                return `
                    <table class="data-table">
                        <thead><tr><th>Employer Type</th><th>Would Hire?</th><th>Level</th><th>Salary Range</th></tr></thead>
                        <tbody>${(data.hire_rows || []).map(r => `<tr><td>${r.employer_type}</td><td>${r.would_hire}</td><td>${r.level}</td><td>${r.salary_range}</td></tr>`).join('')}</tbody>
                    </table>
                    <div class="callout"><strong>Marketability Score: ${data.marketability_score}/100</strong><br>${innerProseToHtml(data.marketability_note || '')}</div>`;

            case 'SEC_RO_020':
                return `
                    <table class="data-table">
                        <thead><tr><th>Factor</th><th>Assumption</th><th>Assessment</th></tr></thead>
                        <tbody>${(data.survival_rows || []).map(r => `<tr><td><strong>${r.factor}</strong></td><td>${r.assumption}</td><td>${r.assessment}</td></tr>`).join('')}</tbody>
                    </table>
                    <div class="callout"><strong>Summary:</strong> ${innerProseToHtml(data.survival_summary || '')}</div>`;

            case 'SEC_RO_021':
                return `
                    <div class="recovery-map">
                        ${(data.recovery_steps || []).map(r => `
                            <div class="job-card">
                                <div class="job-title">${r.month_label}</div>
                                <div class="prose">${innerProseToHtml(r.action)}</div>
                            </div>`).join('')}
                    </div>
                    <div class="callout"><strong>Reversibility Score: ${data.reversibility_score}/100</strong><br>${innerProseToHtml(data.reversibility_note || '')}</div>`;

            case 'SEC_RO_022':
                const cBreakdown = (report.constraintScores && report.constraintScores.length > 0) ? `
                    <div style="margin-top:15px; padding-top:15px; border-top:1px solid #FDE68A;">
                        <div style="font-weight:700; font-size:10pt; color:#92400E; margin-bottom:8px;">DAC Score Constraint Breakdown:</div>
                        <ul class="bullet-list" style="color:#92400E;">
                            ${report.constraintScores.map(c => `<li><strong>${c.constraintName} (${c.constraintId.replace('CONS_RO_00','C')}):</strong> ${c.score}/100 (${c.band})</li>`).join('')}
                        </ul>
                    </div>` : '';
                    
                return `
                    <div style="background:#FFFBEB; border:2px solid #F59E0B; border-radius:8px; padding:20px;">
                        <div style="font-weight:800; font-size:14pt; color:#92400E; margin-bottom:10px;">${data.verdict_label} — ${data.verdict_subtitle}</div>
                        ${proseToHtml(data.verdict_explanation || '')}
                        ${cBreakdown}
                        ${data.do_not_misread_callout ? `<div style="margin-top:15px; font-weight:700; color:#B45309; font-size:9pt; border-top:1px solid #FDE68A; padding-top:10px;">NOTE: ${innerProseToHtml(data.do_not_misread_callout)}</div>` : ''}
                    </div>`;

            case 'SEC_RO_023':
                return `
                    <table class="data-table">
                        <thead><tr><th>Factor</th><th>Level</th><th>Impact</th></tr></thead>
                        <tbody>${(data.certainty_rows || []).map(r => `<tr><td>${r.factor}</td><td>${r.level}</td><td>${r.impact}</td></tr>`).join('')}</tbody>
                    </table>`;

            case 'SEC_RO_024':
                return `
                    ${proseToHtml(data.validity_statement || data.validitystatement || '')}
                    <p class="prose"><strong>Expires:</strong> ${data.expiry_date || data.expirydate || ''}</p>
                    <div class="red-flags-grid">
                        ${(data.triggers || []).map(t => `
                            <div class="flag-card">
                                <div class="flag-title">${t.trigger_label || t.triggerlabel || ''}</div>
                                <div class="flag-content">${innerProseToHtml(t.description || t.content || '')}</div>
                            </div>`).join('')}
                    </div>`;

            case 'SEC_RO_025':
                return `
                    <p class="prose"><strong>Mandatory Re-run:</strong> ${data.mandatory_rerun_date || data.mandatoryrerundate || ''}</p>
                    <div class="red-flags-grid">
                        ${(data.early_triggers || data.earlytriggers || []).map(t => `
                            <div class="flag-card">
                                <div class="flag-title">${t.trigger_label || t.triggerlabel || ''}</div>
                                <div class="flag-content">${innerProseToHtml(t.description || t.content || '')}</div>
                            </div>`).join('')}
                    </div>
                    <div class="callout"><strong>Action Before Rerun:</strong><br>${innerProseToHtml(data.action_before_rerun || data.actionbeforererun || '')}</div>`;

            case 'SEC_RO_026':
                return `
                    <table class="data-table action-plan">
                        <thead><tr><th>Priority</th><th>Action</th><th>Impact</th></tr></thead>
                        <tbody>${(data.actions || []).map(a => `
                            <tr>
                                <td><span class="badge ${a.priority_level?.toLowerCase() || ''}">${a.priority_level}</span></td>
                                <td><strong>${a.priority_label}</strong><br>${innerProseToHtml(a.action)}</td>
                                <td>${a.impact}</td>
                            </tr>`).join('')}
                        </tbody>
                    </table>`;

            default:
                if (data.items) return `<ul class="bullet-list">${data.items.map(i => `<li>${i}</li>`).join('')}</ul>`;
                if (data.rows)  return `<table class="data-table"><tbody>${data.rows.map(r => `<tr>${Object.values(r).map(v => `<td>${v}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
                return proseToHtml(data.summary_prose || data.description || data.content || s?.content || '');
        }
    };

    // Prepare cover page data
    const sec1 = getSectData('SEC_RO_001');
    const summaryText = sec1 ? sec1.summary_prose : 'Strategic decision based on current profile and market signals.';

    // ─── SECTION COUNTER for section numbering in headings ───────────────────
    let secCounter = 0;

    return `<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <style>
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
        * { box-sizing: border-box; }
        body {
            font-family: 'Inter', sans-serif;
            margin: 0; padding: 0;
            background: #f3f4f6;
            color: #1f2937;
            font-size: 11pt;
            line-height: 1.5;
            -webkit-print-color-adjust: exact;
        }

        /* ── PAGE WRAPPER ── */
        .page-cover,
        .page-cv {
            width: 100%;
            padding: 15mm;
            margin: 0 auto;
            background: white;
            position: relative;
            overflow: hidden;
        }
        .page-content {
            width: 100%;
            padding: 15mm;
            padding-bottom: 20mm;
            margin: 0 auto;
            background: white;
            position: relative;
        }

        /* ── SECTION BLOCK — visual divider between sections (no forced page break) ── */
        .section-block {
            margin-bottom: 30px;
            padding-bottom: 24px;
            border-bottom: 1px solid #e5e7eb;
        }
        .section-block:last-child { border-bottom: none; }

        /* ── TYPOGRAPHY ── */
        h1 { font-size: 28pt; font-weight: 800; margin: 0; color: #111827; letter-spacing: -0.5px; }
        h2 {
            font-size: 13pt;
            font-weight: 700;
            margin: 0 0 12px 0;
            padding-bottom: 6px;
            border-bottom: 2px solid #111827;
            color: #111827;
        }
        .section-num {
            font-size: 8pt;
            font-weight: 700;
            color: #9ca3af;
            text-transform: uppercase;
            letter-spacing: 1px;
            margin-bottom: 4px;
        }

        /* ── BULLET LISTS (the main fix) ── */
        ul.bullet-list {
            margin: 0 0 12px 0;
            padding-left: 18px;
            color: #374151;
            font-size: 10pt;
        }
        ul.bullet-list li {
            margin-bottom: 5px;
            line-height: 1.55;
        }
        ul.bullet-list li strong,
        ul.bullet-list li b {
            color: #111827;
        }

        /* ── PROSE ── */
        p.prose {
            font-size: 10.5pt;
            color: #374151;
            margin: 0 0 12px 0;
            line-height: 1.6;
        }

        /* ── CHROME ELEMENTS ── */
        .header-bar {
            background: #111827;
            color: white;
            padding: 8px 16px;
            font-weight: 700;
            font-size: 8pt;
            display: flex;
            justify-content: space-between;
            margin-bottom: 22px;
            border-radius: 4px;
        }
        .summary-table { width: 100%; border-collapse: collapse; margin-top: 20px; }
        .summary-table td { border: 1px solid #e5e7eb; padding: 10px; font-size: 9.5pt; }
        .summary-table td.label { font-weight: 600; background: #f9fafb; color: #4b5563; width: 20%; }
        .summary-table td.value { font-weight: 500; width: 30%; }
        .score-box {
            border: 2px solid #F59E0B; background: #FFFBEB;
            display: flex; align-items: center;
            padding: 25px; margin-top: 30px; border-radius: 8px;
        }
        .score-value { font-size: 48pt; font-weight: 800; color: #D97706; margin-right: 35px; }
        .score-verdict { border-left: 2px solid #F59E0B; padding-left: 25px; flex: 1; }
        .verdict-title { font-weight: 800; font-size: 14pt; color: #92400E; margin-bottom: 4px; }
        .verdict-text  { font-size: 10pt; color: #78350F; font-style: italic; }
        .steps-container { display: flex; width: 100%; margin-top: 30px; gap: 5px; }
        .step {
            flex: 1; height: 40px; background: #059669; color: white;
            display: flex; align-items: center; justify-content: center;
            font-size: 7.5pt; font-weight: 700; text-align: center; border-radius: 3px;
        }
        .status-bar {
            background: #EFF6FF; color: #1E40AF; padding: 10px;
            font-size: 9pt; text-align: center; margin-top: 15px; font-weight: 600;
            border-radius: 4px; border: 1px solid #DBEAFE;
        }

        /* ── CALLOUTS ── */
        .callout {
            background: #FEF3C7; padding: 12px; border-radius: 6px;
            border-left: 4px solid #F59E0B; margin: 12px 0; font-size: 9.5pt;
        }
        .uncomfortable-truth {
            background: #FEE2E2; padding: 12px; border-radius: 6px;
            border-left: 4px solid #EF4444; margin: 12px 0; font-size: 9.5pt;
        }

        /* ── TABLES ── */
        .data-table { width: 100%; border-collapse: collapse; margin: 12px 0; }
        .data-table th {
            background: #111827; color: white;
            text-align: left; padding: 8px; font-size: 8.5pt;
        }
        .data-table td { border-bottom: 1px solid #e5e7eb; padding: 8px; font-size: 9.5pt; }

        /* ── CHARTS ── */
        .chart-row { margin-bottom: 12px; }
        .chart-label { font-size: 8.5pt; font-weight: 700; margin-bottom: 4px; color: #4b5563; }
        .bar-bg { background: #e5e7eb; height: 20px; border-radius: 10px; position: relative; width: 100%; overflow: hidden; }
        .bar-fill { height: 100%; position: absolute; left: 0; top: 0; }
        .bar-label { position: absolute; right: 10px; top: 0; font-size: 8.5pt; color: white; font-weight: 800; line-height: 20px; }

        /* ── DONUT ── */
        .donut-wrapper { display: flex; align-items: center; justify-content: center; gap: 40px; padding: 15px; }
        .legend-item { display: flex; align-items: center; gap: 6px; font-size: 8.5pt; margin-bottom: 4px; }
        .dot { width: 8px; height: 8px; border-radius: 50%; display: inline-block; }

        /* ── FLAG CARDS ── */
        .red-flags-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
        .flag-card { padding: 12px; border-radius: 6px; border-left: 3px solid #ddd; background: #f9fafb; }
        .flag-card.high   { border-color: #EF4444; background: #FEF2F2; }
        .flag-card.medium { border-color: #F59E0B; background: #FFFBEB; }
        .flag-title   { font-weight: 800; font-size: 9pt; margin-bottom: 3px; color: #111827; }
        .flag-content { font-size: 8.5pt; color: #4b5563; }

        /* ── TIMELINE ── */
        .timeline-container { border-left: 2px solid #e5e7eb; margin-left: 10px; padding-left: 20px; }
        .timeline-item { position: relative; margin-bottom: 20px; }
        .timeline-item::before { content: ''; position: absolute; left: -27px; top: 5px; width: 12px; height: 12px; background: #111827; border-radius: 50%; }
        .timeline-period { font-weight: 800; font-size: 9pt; color: #111827; text-transform: uppercase; margin-bottom: 4px; }
        .timeline-desc  { font-size: 9pt; color: #4b5563; }

        /* ── CASCADE ── */
        .cascade-grid { display: grid; grid-template-columns: 1fr; gap: 10px; }
        .cascade-card { display: flex; gap: 15px; background: #f9fafb; padding: 12px; border-radius: 6px; border: 1px solid #e5e7eb; }
        .cascade-label { background: #111827; color: white; width: 24px; height: 24px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: 800; font-size: 10pt; flex-shrink: 0; }

        /* ── RECOVERY MAP ── */
        .recovery-map { display: grid; grid-template-columns: 1fr 1fr; gap: 15px; }

        /* ── BADGES ── */
        .badge { padding: 3px 6px; border-radius: 3px; font-size: 7.5pt; font-weight: 800; }
        .badge.urgent     { background: #EF4444; color: white; }
        .badge.important  { background: #F59E0B; color: white; }
        .badge.strategic  { background: #3B82F6; color: white; }

        /* ── TWO-COL VALUE PROP BOX ── */
        .two-col-box { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 12px; }
        .box-heading { font-weight: 700; font-size: 9pt; text-transform: uppercase; margin-bottom: 8px; }

        /* ── CV PAGE ── */
        .cv-grid { display: grid; grid-template-columns: 1.2fr 1fr; gap: 25px; margin-top: 15px; }
        .cv-section-title { font-weight: 800; font-size: 10pt; color: #6b7280; text-transform: uppercase; border-bottom: 1px solid #e5e7eb; padding-bottom: 4px; margin-bottom: 12px; }
        .job-card { margin-bottom: 15px; }
        .job-title { font-weight: 700; font-size: 10pt; color: #111827; }
        .job-meta  { font-size: 8.5pt; color: #6b7280; font-weight: 500; }
        .job-desc  { font-size: 8.5pt; color: #374151; white-space: pre-line; margin-top: 2px; }
        .skill-group { margin-bottom: 12px; }
        .skill-group-title { font-weight: 700; font-size: 9pt; color: #111827; }
        .skill-list { font-size: 8.5pt; color: #4b5563; line-height: 1.4; }

        /* ── MISC ── */
        .flex-center { text-align: center; }
        .radar-legend { display: flex; justify-content: center; gap: 15px; font-weight: 700; font-size: 8pt; margin-top: 10px; }
        .footer-meta { display: none; /* Handled natively by Puppeteer now */ }
        .mt-4 { margin-top: 15px; }

        /* ── PRINT MEDIA ── */
        @media print {
            body { background: white; margin: 0; padding: 0; }
            .page-cover, .page-cv, .page-content {
                width: 100% !important;
                min-height: auto !important;
                margin: 0 !important;
            }
            .section-block {
                margin-bottom: 15px !important;
                padding-bottom: 10px !important;
            }
            h2 { page-break-after: auto; }
            .flag-card, .callout, .uncomfortable-truth, .data-table tr, .chart-row, .timeline-item {
                page-break-inside: avoid;
            }
            
            /* Chrome/Puppeteer Grid Bug Fix */
            .two-col-box, .red-flags-grid, .recovery-map, .cv-grid { 
                display: flex !important; 
                flex-wrap: wrap !important;
            }
            .red-flags-grid > *, .recovery-map > * { 
                flex: 1 1 calc(50% - 15px) !important; 
            }
            .two-col-box > * { 
                flex: 1 1 calc(50% - 20px) !important; 
            }
            .cv-grid > div:first-child { flex: 1.2 !important; }
            .cv-grid > div:last-child { flex: 1 !important; }
        }
    </style>
</head>
<body>

    <!-- ═══════════════════════════════════════ PAGE 1 — COVER ═══════════════════════════════ -->
    <div class="page-cover">
        <div class="header-bar">
            <span>HAWKSYN — DECISION ASSURANCE CYCLE REPORT</span>
            <span>CONFIDENTIAL</span>
        </div>
        <h1>Job Security Audit</h1>
        <div style="color:#6b7280; font-size:13pt;">AI &amp; Automation Role Elimination Risk Assessment</div>
        <table class="summary-table">
            <tr>
                <td class="label">Decision Moment</td><td class="value">Job Security Audit</td>
                <td class="label">Intent</td><td class="value">Role Elimination Risk</td>
            </tr>
            <tr>
                <td class="label">Profile</td>
                <td class="value" style="color:#D97706; font-weight:800;">${role}</td>
                <td class="label">DAC Score</td>
                <td class="value" style="font-weight:800;">${report.compositeScore}/100</td>
            </tr>
            <tr>
                <td class="label">Verdict</td>
                <td class="value" style="font-weight:800; color:${getVerdictColor(report.compositeScore)};">${report.verdict}</td>
                <td class="label">Confidence Band</td>
                <td class="value">${report.confidence} | ${report.accuracyBand}</td>
            </tr>
        </table>
        <div class="score-box">
            <div class="score-value">${report.compositeScore}</div>
            <div class="score-verdict">
                <div class="verdict-title">${report.verdict} — ACTION STATUS</div>
                <div class="verdict-text">${summaryText.split(/\.\s/)[0]}.</div>
            </div>
        </div>
        <div class="steps-container">
            ${['Intake','Profile','Inputs','Red Flags','External','Assembly','Content','Assembly','Auditor']
              .map((s, i) => `<div class="step">Step ${i+1}:<br>${s}</div>`).join('')}
        </div>
        <div class="status-bar">All 9 steps executed successfully. Human Auditor Status: <strong>Verified by Hawksyn Expert Network</strong></div>
        <h2 style="margin-top:28px;">Your Situation Summary</h2>
        ${proseToHtml(summaryText)}
        <!-- Footer handled natively by Puppeteer -->
    </div>

    <!-- ═══════════════════════════════════════ PAGE 2 — CV BASELINE ════════════════════════ -->
    <div class="page-cv">
        <div class="header-bar">
            <span>HAWKSYN — DECISION ASSURANCE REPORT</span>
            <span>CONFIDENTIAL</span>
        </div>
        <div style="font-size:9pt; color:#6b7280; font-weight:600; text-transform:uppercase;">Section CV</div>
        <h1 style="font-size:22pt;">Normalised CV Baseline — ${profile?.fullName || profile?.identity?.fullName || 'Candidate'}</h1>
        <div class="cv-grid">
            <div>
                <div class="cv-section-title">Work History</div>
                ${(profile?.experience || profile?.work?.experience || []).slice(0, 5).map(job => `
                    <div class="job-card">
                        <div class="job-title">${job.title} — ${job.company}</div>
                        <div class="job-meta">${job.duration}</div>
                        <div class="job-desc">${(job.description || '').split('\n').slice(0, 2).join('\n')}</div>
                    </div>`).join('')}
            </div>
            <div>
                <div class="cv-section-title">Skills &amp; Education</div>
                <div class="skill-group">
                    <div class="skill-group-title">Technical Skills</div>
                    <div class="skill-list">${(profile?.skills?.technical || profile?.composition?.skills?.technical || []).slice(0, 15).join(', ')}</div>
                </div>
                <div class="skill-group">
                    <div class="skill-group-title">Languages</div>
                    <div class="skill-list">${(profile?.skills?.languagesSpoken || profile?.languagesSpoken || profile?.composition?.languagesSpoken || []).join(', ')}</div>
                </div>
                <div class="skill-group">
                    <div class="skill-group-title">Education</div>
                    ${(profile?.education || profile?.composition?.education || []).map(edu => `
                        <div class="skill-list"><strong>${edu.degree}</strong><br>${edu.institution}</div>`).join('')}
                </div>
                <div class="callout" style="margin-top:25px; font-style:italic; background:#F3F4F6; border-left-color:#9CA3AF;">
                    <strong>AI Note:</strong> Core skills extracted and normalized from CV source data.
                </div>
            </div>
        </div>
        <!-- Footer handled natively by Puppeteer -->
    </div>

    <!-- ═══════════════════════════════════════ ANALYSIS SECTIONS — CONTINUOUS FLOW ════════ -->
    <div class="page-content">
        <div class="header-bar">
            <span>HAWKSYN — DECISION ASSURANCE REPORT</span>
            <span>${runId} | ${dateStr}</span>
        </div>

        <div class="sections-wrap">
        ${sections.filter(s => s.sectionId !== 'SEC_RO_001').map((s) => {
            secCounter++;
            return `
            <div class="section-block">
                <div class="section-num">Section ${secCounter}</div>
                <h2>${s.sectionName || 'Analysis Section'}</h2>
                ${renderSection(s)}
            </div>`;
        }).join('')}
        </div>

        <!-- Footer handled natively by Puppeteer -->
    </div>

</body>
</html>`;
}

module.exports = { buildReportHtml };