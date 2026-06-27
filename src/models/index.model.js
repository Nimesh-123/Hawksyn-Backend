const db = {};

db.Admin = require('../modules/admin/admin.model.js');
db.User = require('../modules/user/user.model.js');
db.OTP = require('../modules/user/otp.model.js');
db.AuditLog = require('../modules/user/auditLog.model.js');
db.DocumentUploads = require('../modules/cv/DocumentUploads.model.js');
db.ExtractedCV = require('../modules/cv/ExtractedCV.model.js');
db.PSDEResult = require('../modules/cv/PSDEResult.model.js');
db.AEUAuditLog = require('../modules/cv/AEUAuditLog.model.js');
db.ValidationFailure = require('../modules/cv/ValidationFailure.model.js');
db.ArchetypeRule = require('../modules/cv/ArchetypeRule.model.js');
db.DomainKnowledge = require('../modules/cv/DomainKnowledge.model.js');
db.PopulationBenchmark = require('../modules/cv/PopulationBenchmark.model.js');

// Hawksyn — Decision Assurance Models
db.CaseRegistry = require('../modules/cases/CaseRegistry.model.js');
db.IntentTaxonomy = require('../modules/assurance/IntentTaxonomy.model');
db.Playbooks = require('../modules/assurance/Playbooks.model');
db.CaseIntentConfig = require('../modules/cases/CaseIntentConfig.model.js');
db.Questions = require('../modules/assurance/Questions.model');
db.Constraints = require('../modules/assurance/Constraints.model');
db.ConstraintQuestionMapping = require('../modules/assurance/ConstraintQuestionMapping.model');
db.Contradictions = require('../modules/assurance/Contradictions.model');
db.CoverageRequirements = require('../modules/assurance/CoverageRequirements.model');
db.RedFlagTaxonomy = require('../modules/assurance/RedFlagTaxonomy.model');
db.AccuracyScoringPolicy = require('../modules/assurance/AccuracyScoringPolicy.model');
db.Warnings = require('../modules/assurance/Warnings.model');
db.IntegrityEligibilityRules = require('../modules/assurance/IntegrityEligibilityRules.model');
db.DroMaster = require('../modules/assurance/DroMaster.model');
db.RiskConstraintMap = require('../modules/assurance/RiskConstraintMap.model');
db.VerdictLogicTable = require('../modules/assurance/VerdictLogicTable.model');
db.EvaluationLibraryRegistry = require('../modules/assurance/EvaluationLibraryRegistry.model');
db.GuardrailRegistry = require('../modules/assurance/GuardrailRegistry.model');
db.DecisionAssuranceSections = require('../modules/assurance/DecisionAssuranceSections.model');
db.PromptConfigRegistry = require('../modules/assurance/PromptConfigRegistry.model');
db.ObjectiveScoringTaxonomy = require('../modules/assurance/ObjectiveScoringTaxonomy.model');
db.AiPrompt = require('../modules/assurance/AiPrompt.model.js');
db.Runs = require('../modules/assurance/Runs.model');
db.Payments = require('../modules/billing/Payments.model.js');
db.Invoice = require('../modules/billing/Invoice.model.js');
db.Ledger = require('../modules/billing/Ledger.model.js');

db.UserProfile = require('../modules/user/UserProfile.model.js');
db.DependencyRules = require('../modules/assurance/DependencyRules.model');
db.ExternalSignalTaxonomy = require('../modules/signals/ExternalSignalTaxonomy.model.js');
db.SourceRegistry = require('../modules/signals/SourceRegistry.model.js');
db.DataPatternKeyTaxonomy = require('../modules/signals/DataPatternKeyTaxonomy.model.js');
db.RiskAuditorRegistry = require('../modules/assurance/RiskAuditorRegistry.model');
db.MandatoryObjectiveInput = require('../modules/assurance/MandatoryObjectiveInput.model');
db.MoiQuestionMapping = require('../modules/assurance/MoiQuestionMapping.model');
db.Ras = require('../modules/assurance/Ras.model');
db.CaseFile = require('../modules/cases/CaseFile.model.js');
db.ExternalEvidenceDataPool = require('../modules/signals/ExternalEvidenceDataPool.model.js');

// Command Center — Trend & Clock Models
db.MarketPulse = require('../modules/commandCenter/MarketPulse.model.js');
db.UserClocks = require('../modules/commandCenter/UserClocks.model.js');
db.ClockHistory = require('../modules/commandCenter/ClockHistory.model.js');
db.UserCredits  = require('../modules/billing/UserCredits.model.js');
db.ExpertQuery = require('../modules/expert/ExpertQuery.model.js');
db.ChatMessage = require('../modules/expert/ChatMessage.model.js');
db.Notifications = require('../modules/notification/Notification.model.js');
db.SystemConfig = require('../modules/admin/SystemConfig.model.js');
db.FAQ = require('../modules/support/FAQ.model.js');
db.LegalContent = require('../modules/support/LegalContent.model.js');

// HIP Models
db.HipGuardrailRule = require('../modules/hip/HipGuardrailRule.model.js');

db.HipSectionPrompt = require('../modules/hip/HipSectionPrompt.model.js');
db.HipProfile = require('../modules/hip/HipProfile.model.js');

// Helpdesk Models
db.Ticket = require('../modules/helpdesk/Ticket.model.js');
db.TicketMessage = require('../modules/helpdesk/TicketMessage.model.js');


module.exports = { db };
