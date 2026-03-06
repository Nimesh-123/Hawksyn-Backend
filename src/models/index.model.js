const db = {};

db.Admin = require('../models/admin.model.js');
db.User = require('../models/user.model.js');
db.OTP = require('../models/otp.model.js');
db.AuditLog = require('../models/auditLog.model.js');
db.UserCvUploads = require('../models/user_cv_uploads.model.js');

// Hawksyn — Decision Assurance Models
db.CaseRegistry = require('./CaseRegistry');
db.IntentTaxonomy = require('./IntentTaxonomy');
db.CvFileRules = require('./CvFileRules');
db.Playbooks = require('./Playbooks');
db.CaseIntentConfig = require('./CaseIntentConfig');
db.Questions = require('./Questions');
db.InputSchemas = require('./InputSchemas');
db.Constraints = require('./Constraints');
db.ConstraintQuestionMapping = require('./ConstraintQuestionMapping');
db.Contradictions = require('./Contradictions');
db.CoverageRequirements = require('./CoverageRequirements');
db.RedFlagTaxonomy = require('./RedFlagTaxonomy');
db.AccuracyScoringPolicy = require('./AccuracyScoringPolicy');
db.Warnings = require('./Warnings');
db.EvaluationLibraryRegistry = require('./EvaluationLibraryRegistry');
db.GuardrailRegistry = require('./GuardrailRegistry');
db.DecisionAssuranceSections = require('./DecisionAssuranceSections');
db.PromptConfigRegistry = require('./PromptConfigRegistry');

module.exports = { db };
