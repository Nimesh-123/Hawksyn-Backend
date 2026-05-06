const db = {};

db.Admin = require('./admin.model.js');
db.User = require('./user.model.js');
db.OTP = require('./otp.model.js');
db.AuditLog = require('./auditLog.model.js');
db.DocumentUploads = require('./DocumentUploads.model');

// Hawksyn — Decision Assurance Models
db.CaseRegistry = require('./CaseRegistry.model');
db.IntentTaxonomy = require('./IntentTaxonomy.model');
db.DocumentFileRules = require('./DocumentFileRules.model');
db.Playbooks = require('./Playbooks.model');
db.CaseIntentConfig = require('./CaseIntentConfig.model');
db.Questions = require('./Questions.model');
db.Constraints = require('./Constraints.model');
db.ConstraintQuestionMapping = require('./ConstraintQuestionMapping.model');
db.Contradictions = require('./Contradictions.model');
db.CoverageRequirements = require('./CoverageRequirements.model');
db.RedFlagTaxonomy = require('./RedFlagTaxonomy.model');
db.AccuracyScoringPolicy = require('./AccuracyScoringPolicy.model');
db.Warnings = require('./Warnings.model');
db.IntegrityEligibilityRules = require('./IntegrityEligibilityRules.model');
db.DroMaster = require('./DroMaster.model');
db.RiskConstraintMap = require('./RiskConstraintMap.model');
db.VerdictLogicTable = require('./VerdictLogicTable.model');
db.EvaluationLibraryRegistry = require('./EvaluationLibraryRegistry.model');
db.GuardrailRegistry = require('./GuardrailRegistry.model');
db.DecisionAssuranceSections = require('./DecisionAssuranceSections.model');
db.PromptConfigRegistry = require('./PromptConfigRegistry.model');
db.ObjectiveScoringTaxonomy = require('./ObjectiveScoringTaxonomy.model');
db.AiPrompt = require('./AiPrompt.model.js');
db.Runs = require('./Runs.model');
db.Payments = require('./Payments.model');
db.Invoice = require('./Invoice.model');
db.Ledger = require('./Ledger.model');

db.UserProfile = require('./UserProfile.model');
db.DependencyRules = require('./DependencyRules.model');
db.ExternalSignalTaxonomy = require('./ExternalSignalTaxonomy.model');
db.SourceRegistry = require('./SourceRegistry.model');
db.DataPatternKeyTaxonomy = require('./DataPatternKeyTaxonomy.model');
db.RiskAuditorRegistry = require('./RiskAuditorRegistry.model');
db.MandatoryObjectiveInput = require('./MandatoryObjectiveInput.model');
db.MoiQuestionMapping = require('./MoiQuestionMapping.model');
db.Ras = require('./Ras.model');
db.CaseFile = require('./CaseFile.model');
db.ExternalEvidenceDataPool = require('./ExternalEvidenceDataPool.model');

// Command Center — Trend & Clock Models
db.MarketPulse = require('./MarketPulse.model');
db.UserClocks = require('./UserClocks.model');
db.ClockHistory = require('./ClockHistory.model');
db.UserCredits  = require('./UserCredits.model');
db.ExpertQuery = require('./ExpertQuery.model');
db.ChatMessage = require('./ChatMessage.model');
db.Notifications = require('./Notification.model.js');
db.SystemConfig = require('./SystemConfig.model');
db.FAQ = require('./FAQ.model.js');
db.LegalContent = require('./LegalContent.model.js');

module.exports = { db };
