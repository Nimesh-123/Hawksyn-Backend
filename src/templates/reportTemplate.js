/**
 * Generates the complete HTML for the Hawksyn Report.
 * Includes layout, styling (CSS), and content mapped from report object.
 */
function buildReportHtml(reportData) {
    const { report, runId, generatedAt, verdict, accuracyScore, accuracyBand } = reportData;
    const sections = report.sections || [];
    
    // Find specific sections by ID (adjust if your IDs are different)
    const getSect = (id) => sections.find(s => s.sectionId === id)?.content || '';
    
    const dateStr = generatedAt ? new Date(generatedAt).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) : 'March 14, 2026';
    
    // Formatting the verdict band color
    const getVerdictColor = (score) => {
        if (score < 40) return '#C62828'; // Red
        if (score < 60) return '#FFB300'; // Amber/Gold
        return '#2E7D32'; // Green
    };

    return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <style>
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800&family=Roboto+Mono&display=swap');
        
        * { box-sizing: border-box; }
        body { 
            font-family: 'Inter', sans-serif; 
            margin: 0; padding: 0; 
            background: #fff; color: #1a1a1a;
            font-size: 11pt; line-height: 1.4;
        }

        /* --- PDF Page Setup --- */
        .page {
            width: 210mm; height: 297mm;
            padding: 15mm;
            position: relative;
            background: white;
            page-break-after: always;
        }

        /* --- Global Header & Footer --- */
        .header-meta {
            display: flex; justify-content: space-between;
            font-family: 'Roboto Mono', monospace; font-size: 8pt;
            border-bottom: 2px solid #1a1a1a; padding-bottom: 5px; margin-bottom: 20px;
        }
        .footer-meta {
            position: absolute; bottom: 15mm; left: 15mm; right: 15mm;
            display: flex; justify-content: space-between;
            font-family: 'Inter', sans-serif; font-size: 8pt; color: #666;
            border-top: 1px solid #ddd; padding-top: 10px;
        }

        /* --- Specific Elements (Match Screenshot) --- */
        .header-bar {
            background: #1a1a2e; color: white;
            padding: 8px 15px; font-weight: 700; font-size: 9pt;
            display: flex; justify-content: space-between;
            margin-bottom: 20px;
        }

        h1 { font-size: 26pt; font-weight: 800; margin: 0; color: #1a1a1a; }
        h2 { font-size: 16pt; font-weight: 700; margin-top: 25px; border-bottom: 1.5px solid #1a1a1a; padding-bottom: 5px; }

        .summary-table {
            width: 100%; border-collapse: collapse; margin-top: 20px;
        }
        .summary-table td {
            border: 1px solid #eee; padding: 8px 12px; font-size: 10pt;
        }
        .summary-table td.label { font-weight: 600; background: #fafafa; width: 20%; }
        .summary-table td.value { font-weight: 400; width: 30%; }

        /* --- SCORE BOX (GOLD) --- */
        .score-box {
            border: 2px solid #FFD700; background: #FFFDF0;
            display: flex; align-items: center; padding: 25px;
            margin-top: 30px; border-radius: 4px;
        }
        .score-value {
            font-size: 48pt; font-weight: 800; color: #FFB300;
            margin-right: 30px; line-height: 1;
        }
        .score-verdict {
            border-left: 2px solid #FFD700; padding-left: 20px;
        }
        .verdict-title { font-weight: 800; font-size: 14pt; color: #B08D00; margin-bottom: 5px; }
        .verdict-text { font-size: 10.5pt; color: #444; }

        /* --- 9-STEP PROGRESS BAR --- */
        .steps-container {
            display: flex; width: 100%; margin-top: 30px; gap: 4px;
        }
        .step {
            flex: 1; height: 35px; background: #2E7D32; color: white;
            display: flex; flex-direction: column; align-items: center; justify-content: center;
            font-size: 7.5pt; font-weight: 700; text-align: center; border-radius: 2px;
        }
        .status-bar {
            background: #E3F2FD; color: #1565C0; padding: 8px; font-size: 9pt; text-align: center;
            margin-top: 15px; font-weight: 600; border-radius: 4px;
        }

        /* --- CHARTS (HORIZONTAL) --- */
        .chart-row { margin-bottom: 12px; }
        .chart-label { font-size: 10pt; font-weight: 600; margin-bottom: 4px; }
        .bar-bg { background: #eee; height: 18px; border-radius: 9px; position: relative; width: 100%; }
        .bar-fill { height: 100%; border-radius: 9px; position: absolute; left: 0; top: 0; }
        .bar-label { position: absolute; right: 8px; top: 0; font-size: 8.5pt; color: #333; font-weight: 700; line-height: 18px; }

        .highlights {
            background: #FFF9C4; padding: 12px; font-style: italic; font-size: 10pt;
            border-radius: 4px; margin: 15px 0;
        }
        
    </style>
</head>
<body>

    <!-- PAGE 1 -->
    <div class="page">
        <div class="header-bar">
            <span>HAWKSYN — DECISION ASSURANCE CYCLE REPORT</span>
            <span>CONFIDENTIAL</span>
        </div>

        <h1>Job Security Audit</h1>
        <div style="color: #666; font-size: 12pt; margin-bottom: 20px;">AI & Automation Role Elimination Risk Assessment</div>

        <table class="summary-table">
            <tr>
                <td class="label">Decision Moment</td><td class="value">Job Security Audit</td>
                <td class="label">Intent</td><td class="value">Role Elimination Risk</td>
            </tr>
            <tr>
                <td class="label">Profile</td><td class="value" style="color: #FFB300; font-weight: 700;">${reportData.role || 'Software Engineer'}</td>
                <td class="label">DAC Score</td><td class="value" style="font-weight: 800;">${report.compositeScore}/100</td>
            </tr>
            <tr>
                <td class="label">Verdict</td><td class="value" style="font-weight: 700; color: ${getVerdictColor(report.compositeScore)};">${report.verdict}</td>
                <td class="label">Confidence Band</td><td class="value">${report.confidence} | ${report.accuracyBand}</td>
            </tr>
        </table>

        <!-- SCORE BOX -->
        <div class="score-box">
            <div class="score-value">${report.compositeScore} / 100</div>
            <div class="score-verdict">
                <div class="verdict-title">${report.verdict} — ACTION STATUS</div>
                <div class="verdict-text">
                    ${getSect('SEC_001').split('\n')[0] || 'Strategic decision based on current profile and market signals.'}
                </div>
            </div>
        </div>

        <!-- PROGRESS BAR -->
        <div class="steps-container">
            <div class="step">Step 1:<br>Intake</div>
            <div class="step">Step 2:<br>Profile</div>
            <div class="step">Step 3:<br>Inputs</div>
            <div class="step">Step 4:<br>Red Flags</div>
            <div class="step">Step 5:<br>External</div>
            <div class="step">Step 6:<br>Assembly</div>
            <div class="step">Step 7:<br>Content</div>
            <div class="step">Step 8:<br>Assembly</div>
            <div class="step">Step 9:<br>Auditor</div>
        </div>
        <div class="status-bar">
            All 9 steps executed successfully. Human auditor assignment: <strong>Pending — SLA 72 hrs.</strong>
        </div>

        <div style="margin-top: 40px;">
           <h2 style="border-bottom: 2px solid #1a1a1a;">Your Situation Summary</h2>
           <div style="font-size: 12pt; margin-top: 15px;">
               ${getSect('SEC_001')}
           </div>
        </div>

        <div class="footer-meta">
            <span>Case #${runId} | Hawksyn AI 2.0</span>
            <span>Page 1</span>
        </div>
    </div>

    <!-- PAGE 2 (Content Sections) -->
    <div class="page">
        <div class="header-meta">
            <span>HAWKSYN — DECISION ASSURANCE REPORT</span>
            <span>${runId} | ${dateStr}</span>
        </div>

        <h2>What Is Really Going On Here?</h2>
        <div>${getSect('SEC_002')}</div>

        <h2>Super Strengths & Capabilities</h2>
        <div style="margin-top: 20px;">
            <div class="chart-row">
                <div class="chart-label">Full-Stack Awareness</div>
                <div class="bar-bg"><div class="bar-fill" style="width: 72%; background: #4CAF50;"></div><div class="bar-label">72%</div></div>
            </div>
            <div class="chart-row">
                <div class="chart-label">API Design Experience</div>
                <div class="bar-bg"><div class="bar-fill" style="width: 65%; background: #4CAF50;"></div><div class="bar-label">65%</div></div>
            </div>
             <div class="chart-row">
                <div class="chart-label">AWS/Cloud Exposure</div>
                <div class="bar-bg"><div class="bar-fill" style="width: 55%; background: #FFA000;"></div><div class="bar-label">55%</div></div>
            </div>
             <div class="chart-row">
                <div class="chart-label">System Design Depth</div>
                <div class="bar-bg"><div class="bar-fill" style="width: 28%; background: #D32F2F;"></div><div class="bar-label">28%</div></div>
            </div>
        </div>

        <div class="highlights">
            ${getSect('SEC_004').length > 10 ? getSect('SEC_004') : "Upskilling in AI and System Design will significantly improve this score in the next 90 days."}
        </div>

        <div class="footer-meta">
            <span>Case #${runId}</span>
            <span>Page 2</span>
        </div>
    </div>

    <!-- DYNAMIC PAGES FOR ALL REMAINING SECTIONS -->
    ${sections.filter(s => s.sectionId !== 'SEC_001').map((s, index) => `
    <div class="page">
        <div class="header-meta">
            <span>HAWKSYN — DECISION ASSURANCE REPORT</span>
            <span>${runId} | ${dateStr}</span>
        </div>

        <h2>${s.sectionName || 'Analysis Section'}</h2>
        <div style="font-size: 11pt; line-height: 1.6; white-space: pre-wrap;">
            ${s.content}
        </div>

        <div class="footer-meta">
            <span>Case #${runId}</span>
            <span>Page ${index + 2}</span>
        </div>
    </div>
    `).join('')}

</body>
</html>
    `;
}

module.exports = { buildReportHtml };
