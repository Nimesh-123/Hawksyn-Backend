/**
 * Chronology Repair Engine
 * Features: Date inference, Continuity repair, Overlap-safe tenure
 */

function repairChronology(roles) {
    if (!roles || roles.length === 0) return roles;

    // 1. Detect and Normalize Reverse Chronology
    const dates = roles.map(r => parseDate(r.role_metadata?.start_date));
    const isReverse = dates[0] > dates[dates.length - 1];
    let sortedRoles = isReverse ? [...roles].reverse() : [...roles];

    // 2. Infer Missing Dates in Promotion Chains
    for (let i = 1; i < sortedRoles.length; i++) {
        const current = sortedRoles[i].role_metadata;
        const previous = sortedRoles[i - 1].role_metadata;

        // Same employer continuity
        if (current.company_canonical === previous.company_canonical && !current.start_date && previous.end_date) {
            current.start_date = previous.end_date;
            sortedRoles[i].flags = sortedRoles[i].flags || [];
            sortedRoles[i].flags.push('inferred_promotion_start_date');
        }
    }

    return sortedRoles;
}

function detectChronologyRisks(roles) {
    if (!roles || roles.length < 1) return { overlapFlag: false, gapPeriods: [] };

    const dates = roles.map(r => ({
        start: parseDate(r.role_metadata?.start_date),
        end: /present|current/i.test(r.role_metadata?.end_date) ? new Date() : parseDate(r.role_metadata?.end_date || r.role_metadata?.start_date),
        index: r.role_index
    })).filter(d => d.start && d.end);

    // Sort by start date (chronological)
    dates.sort((a, b) => a.start - b.start);

    const gapPeriods = [];
    let overlapFlag = false;

    for (let i = 1; i < dates.length; i++) {
        const prev = dates[i - 1];
        const current = dates[i];

        // 1. Detect Gaps (> 3 months)
        const gapMonths = monthDiff(prev.end, current.start);
        if (gapMonths > 3) {
            gapPeriods.push({
                gap_months: gapMonths,
                after_role: prev.index,
                before_role: current.index
            });
        }

        // 2. Detect Overlaps (> 2 months)
        if (current.start < prev.end) {
            const overlapMonths = monthDiff(current.start, prev.end);
            if (overlapMonths > 2) overlapFlag = true;
        }
    }

    return { overlapFlag, gapPeriods };
}


function calculateIntervalsMonths(intervals) {
    if (intervals.length === 0) return 0;
    
    // Clone and sort
    const sorted = [...intervals].sort((a, b) => a.start - b.start);
    let totalMonths = 0;
    
    let mStart = sorted[0].start;
    let mEnd = sorted[0].end;

    for (let i = 1; i < sorted.length; i++) {
        if (sorted[i].start <= mEnd) {
            mEnd = new Date(Math.max(mEnd, sorted[i].end));
        } else {
            totalMonths += monthDiff(mStart, mEnd);
            mStart = sorted[i].start;
            mEnd = sorted[i].end;
        }
    }
    totalMonths += monthDiff(mStart, mEnd);

    return totalMonths;
}

function calculateExperienceMonths(roles) {
    const allIntervals = [];
    const corporateIntervals = [];

    roles.forEach(role => {
        const meta = role.role_metadata;
        if (meta?.start_date) {
            const start = parseDate(meta.start_date);
            const end = /present|current/i.test(meta.end_date) ? new Date() : parseDate(meta.end_date || meta.start_date);
            if (start && end && end > start) {
                const interval = { start, end };
                allIntervals.push(interval);
                
                // Exclude entrepreneurial roles and internships from the chronological corporate track
                const title = (meta.title || '').toLowerCase();
                const isEntrepreneurial = /founder|co-founder|freelance|self-employed|entrepreneur/i.test(title);
                const isInternship = /intern|internship/i.test(title);
                if (!isEntrepreneurial && !isInternship) {
                    corporateIntervals.push(interval);
                }
            }
        }
    });

    const total_claimed_months = calculateIntervalsMonths(allIntervals);
    const chronological_full_time_months = calculateIntervalsMonths(corporateIntervals);

    // Maintain backwards compatibility if it's used as a primitive elsewhere
    const result = new Number(total_claimed_months);
    result.total_claimed_months = total_claimed_months;
    result.chronological_full_time_months = chronological_full_time_months;

    return result;
}

function monthDiff(d1, d2) {
    return (d2.getFullYear() - d1.getFullYear()) * 12 + (d2.getMonth() - d1.getMonth());
}

function parseDate(d) {
    if (!d) return null;
    const date = new Date(d);
    return isNaN(date.getTime()) ? null : date;
}

module.exports = { repairChronology, calculateExperienceMonths, detectChronologyRisks };
