// ═══════════════════════════════════════════════════════════════════
// HAWKSYN — SLA Breach Detection & Auto-Escalation Cron
// File: src/modules/assurance/crons/slaBreach.cron.js
// ═══════════════════════════════════════════════════════════════════

const cron = require('node-cron');
const { db } = require('../../../models/index.model.js');
const { scoreExpert, buildAssignmentReason } = require('../../expert/services/expertService.js');
const notificationService = require('../../../services/notificationService');

async function checkSlaBreaches() {
    console.log('\n[SLACron] ⏳ Checking for active expert review SLA breaches...');

    try {
        // Find all cases currently assigned to an expert and pending review
        const activeAssignedRuns = await db.Runs.find({
            status: 'EXPERT_ASSIGNED',
            expertId: { $ne: null },
            expertReviewedAt: null
        }).populate('expertId');

        if (activeAssignedRuns.length === 0) {
            console.log('[SLACron] ✅ No active expert reviews pending.');
            return;
        }

        const now = new Date();

        for (const run of activeAssignedRuns) {
            const expert = run.expertId;
            if (!expert) continue;

            // 1. Calculate SLA Hours Dynamically
            // Prioritize expert commitment hours, then system config settings, falling back to 72 hours
            let slaHours = expert.slaCommitmentHours || 72;
            
            try {
                const systemConfig = await db.SystemConfig.findOne({ configKey: 'GLOBAL_SETTINGS' });
                if (systemConfig && systemConfig.configValue && systemConfig.configValue.chatSettings && systemConfig.configValue.chatSettings.slaCommitmentHours) {
                    slaHours = systemConfig.configValue.chatSettings.slaCommitmentHours;
                }
            } catch (cfgErr) {
                console.warn('[SLACron] Failed to fetch system SLA config, using fallback:', cfgErr.message);
            }

            const expertAssignedTime = new Date(run.expertAssignedAt || run.updatedAt);
            const breachThreshold = new Date(expertAssignedTime.getTime() + (slaHours * 60 * 60 * 1000));

            // Check if SLA has breached
            if (now > breachThreshold) {
                console.log(`[SLACron] 🚩 Breach Detected! Run: ${run.runId} has exceeded its SLA window of ${slaHours}h.`);

                // Mark as breached if not already done
                if (!run.isSlaBreached) {
                    await db.Runs.updateOne({ _id: run._id }, { $set: { isSlaBreached: true } });
                    
                    // Create Audit Log of initial breach detection
                    await db.AuditLog.create({
                        action: 'SLA_BREACH_DETECTED',
                        userId: run.userId,
                        metadata: {
                            runId: run.runId,
                            caseId: run.caseId,
                            unresponsiveExpertId: expert._id,
                            unresponsiveExpertName: expert.auditorName,
                            assignedAt: run.expertAssignedAt,
                            slaHoursLimit: slaHours
                        }
                    });

                    try {
                        const user = await db.User.findById(run.userId);
                        if (user) {
                            await notificationService.notifySLABreach(run.runId, user);
                        }
                    } catch (notifErr) {
                        console.error(`[SLACron] Failed to notify user of initial SLA breach:`, notifErr.message);
                    }
                }

                // 2. Perform Auto-Escalation & Reassignment (D51 Escalation Rules)
                console.log(`[SLACron] 🚀 Triggering automatic expert reassignment for Run: ${run.runId}...`);

                // Query for other active experts qualified for this case category with daily capacity
                const availableExperts = await db.RiskAuditorRegistry.find({
                    _id: { $ne: expert._id }, // Exclude current unresponsive expert
                    $or: [
                        { caseCategories: { $in: [run.caseId] } },
                        { caseId: run.caseId }
                    ],
                    isActive: true,
                    status: 'ACTIVE',
                    $expr: { $lt: ['$dailyCaseloadCount', '$maxCaseload'] }
                });

                if (availableExperts.length === 0) {
                    console.warn(`[SLACron] ⚠️ Reassignment failed: No other active expert matches case: ${run.caseId} with capacity.`);
                    
                    // Log audit warnings for manual admin intervention
                    await db.AuditLog.create({
                        action: 'SLA_ESCALATION_FAILED',
                        userId: run.userId,
                        metadata: {
                            runId: run.runId,
                            caseId: run.caseId,
                            reason: 'No eligible backup experts are online with caseload capacity.'
                        }
                    });
                    continue; // Skip to next run
                }

                // Extract final report & integrity details to run robust RAR matching rules
                let redFlags = [];
                let integrityConstraints = [];
                let clientRole = '';
                try {
                    const reportRas = await db.Ras.findOne({ runId: run.runId, artifactType: 'FINAL_REPORT' });
                    if (reportRas && reportRas.artifactJson) {
                        redFlags = reportRas.artifactJson.redFlags || [];
                    }
                    const integrityRas = await db.Ras.findOne({ runId: run.runId, artifactType: 'INTEGRITY_PACK' });
                    if (integrityRas && integrityRas.artifactJson) {
                        integrityConstraints = integrityRas.artifactJson.constraints?.results || [];
                    }
                    const runObj = await db.Runs.findOne({ runId: run.runId });
                    if (runObj && runObj.cvSnapshot && runObj.cvSnapshot.parsedData) {
                        clientRole = runObj.cvSnapshot.parsedData.identity?.currentRoleTitle || runObj.cvSnapshot.parsedData.work?.role || '';
                    }
                } catch (dataErr) {
                    console.error('[SLACron] Error reading run report artifacts, falling back to caseload matching:', dataErr.message);
                }

                const caseDomain = run.caseId;

                // Score candidate experts to find the best replacement
                const scoredExperts = availableExperts.map(cand => {
                    const scoring = scoreExpert(cand, redFlags, integrityConstraints, clientRole, caseDomain);
                    const reason = buildAssignmentReason(cand, redFlags, integrityConstraints, scoring);
                    return { candidate: cand, scoring, reason };
                });

                scoredExperts.sort((a, b) => b.scoring.totalScore - a.scoring.totalScore);
                const bestMatch = scoredExperts[0];

                const reassignedTime = new Date();
                
                // 3. Caseload shift: decrement unresponsive expert, increment new expert
                await db.RiskAuditorRegistry.updateOne(
                    { _id: expert._id },
                    { $inc: { currentCaseload: -1 } }
                );

                await db.RiskAuditorRegistry.updateOne(
                    { _id: bestMatch.candidate._id },
                    { $inc: { currentCaseload: 1, dailyCaseloadCount: 1 } }
                );

                // 4. Update the Run with new expert and reset timers
                await db.Runs.updateOne(
                    { _id: run._id },
                    {
                        $set: {
                            expertId: bestMatch.candidate._id,
                            expertAssignedAt: reassignedTime,
                            isSlaBreached: false // Reset breach flag for the new expert
                        }
                    }
                );

                // 5. Create a new EXPERT_ASSIGNED artifact for step 6 (Audit Trail integrity)
                const expRasId = `RAS_EXP_${Date.now()}_${Math.floor(1000 + Math.random() * 9000)}`;
                const assignmentArtifact = {
                    runId: run.runId,
                    assignedExpert: {
                        auditorId: bestMatch.candidate.auditorId,
                        auditorName: bestMatch.candidate.auditorName,
                        specializations: bestMatch.candidate.specializations,
                        assignedAt: reassignedTime,
                        assignmentReason: `Auto-Escalation: ${bestMatch.reason}`,
                        scoreBreakdown: {
                            total: bestMatch.scoring.totalScore,
                            specialization: bestMatch.scoring.specializationScore,
                            load: bestMatch.scoring.loadScore
                        }
                    },
                    verdict: run.verdict || 'PAUSE',
                    escalationRequired: true,
                    assignmentStatus: 'ASSIGNED',
                    assignedAt: reassignedTime
                };

                await db.Ras.create({
                    rasId: expRasId,
                    runId: run.runId,
                    stepNo: 6,
                    artifactType: 'EXPERT_ASSIGNED',
                    artifactVersion: 1,
                    artifactJson: assignmentArtifact,
                    status: 'FINAL'
                });

                // 6. Log dynamic escalation event
                await db.AuditLog.create({
                    action: 'SLA_BREACH_ESCALATED',
                    userId: run.userId,
                    metadata: {
                        runId: run.runId,
                        caseId: run.caseId,
                        unresponsiveExpertId: expert._id,
                        unresponsiveExpertName: expert.auditorName,
                        newExpertId: bestMatch.candidate._id,
                        newExpertName: bestMatch.candidate.auditorName,
                        assignmentReason: bestMatch.reason,
                        timestamp: reassignedTime
                    }
                });

                // 7. Send notification alerts
                try {
                    const user = await db.User.findById(run.userId);
                    if (user) {
                        // Alert the new expert & notify the user of replacement
                        await notificationService.notifyExpertAssigned(run.runId, user, bestMatch.candidate);
                    }
                } catch (alertErr) {
                    console.error('[SLACron] Escalation alerts failed:', alertErr.message);
                }

                console.log(`[SLACron] ✅ Reassigned successfully to Expert: ${bestMatch.candidate.auditorName}`);
            }
        }

    } catch (error) {
        console.error('[SLACron] ❌ Fatal error during SLA breach review:', error.message);
    }
}

// Check every hour
cron.schedule('0 * * * *', checkSlaBreaches, {
    timezone: 'Asia/Kolkata'
});

module.exports = { checkSlaBreaches };
