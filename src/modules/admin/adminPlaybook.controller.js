const XLSX = require('xlsx');
const { db } = require('../../models/index.model.js');
const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');

const { createAuditLog } = require('../../../utils/auditLogger.js');
const { PLAYBOOK_MAPPING, parseSafeJson, toSnakeCase, toCamelCase } = require('./helpers/playbookHelpers.js');

// --- In-Memory Temporary Storage (For Demo - In production use Redis or filesystem) ---
const tempStorage = new Map();

/**
 * Download Excel Template (Pre-filled with Case data if provided)
 * GET /api/v1/admin/template/download?caseId=CASE_ID
 */
exports.downloadPlaybookTemplate = async (req, res) => {
    try {
        const { caseId } = req.query;
        const workbook = XLSX.utils.book_new();

        // NEW: Fetch related intentIds for this case to filter shared models like IntentTaxonomy
        let relatedIntentIds = [];
        if (caseId) {
            const configs = await db.CaseIntentConfig.find({ caseId }).select('intentId').lean();
            relatedIntentIds = configs.map(c => c.intentId);
        }

        // 1. Iterate over our 24 Sheets
        for (const sheetName of Object.keys(PLAYBOOK_MAPPING)) {
            const config = PLAYBOOK_MAPPING[sheetName];
            const Model = db[config.model];

            if (!Model) {
                console.warn(`[Template Gen] Model ${config.model} not found for sheet ${sheetName}`);
                continue;
            }

            // 2. Fetch Data (If no caseId, return empty for blank template)
            let query = {};
            if (caseId) {
                const schema = Model.schema.paths;
                if (schema.caseId) query.caseId = caseId;
                else if (schema.caseScope) query.caseScope = caseId;
                else if (schema.targetCaseId) query.targetCaseId = caseId;
                // Special Relationship Filtering
                else if (config.model === 'IntentTaxonomy') {
                    query.intentId = { $in: relatedIntentIds };
                }
            } else {
                // FORCE EMPTY: We only want headers for a new case
                query = { _id: null };
            }
            const rawData = await Model.find(query).lean();

            // 3. Inverse Transformation (Merged DB -> Separate Sheets)

            const processedData = rawData.map(item => {
                const row = {};
                const { _id, __v, createdAt, updatedAt, ...cleanItem } = item;

                Object.keys(cleanItem).forEach(key => {
                    let keep = true;

                    // Special split logic for Questions (Sheet 05) and Scoring (Sheet 06)
                    const isQuestionsModel = config.model === 'Questions';
                    if (isQuestionsModel) {
                        if (sheetName.includes('Questions') && !sheetName.includes('Scoring') && key.toLowerCase().includes('score')) keep = false;
                        if (sheetName.includes('Scoring') && !['questionId', 'questionText'].includes(key) && !key.toLowerCase().includes('score')) keep = false;
                    }

                    if (keep) {
                        const excelHeader = toSnakeCase(key);
                        let val = cleanItem[key];
                        if (val && typeof val === 'object') val = JSON.stringify(val);
                        row[excelHeader] = val;
                    }
                });
                return row;
            });

            // 4. Create Sheet (Ensure headers exist even if no data)
            let worksheet;
            if (processedData.length > 0) {
                worksheet = XLSX.utils.json_to_sheet(processedData);
            } else {
                // Generate headers from Model Schema for Blank Template
                const schemaPaths = Object.keys(Model.schema.paths).filter(p => !['_id', '__v', 'createdAt', 'updatedAt'].includes(p));
                const headers = {};
                schemaPaths.forEach(p => {
                    let keep = true;
                    // Special split logic for Questions (Sheet 05) and Scoring (Sheet 06)
                    const isQuestionsModel = config.model === 'Questions';
                    if (isQuestionsModel) {
                        if (sheetName.includes('Questions') && !sheetName.includes('Scoring') && p.toLowerCase().includes('score')) keep = false;
                        if (sheetName.includes('Scoring') && !['questionId', 'questionText'].includes(p) && !p.toLowerCase().includes('score')) keep = false;
                    }

                    if (keep) headers[toSnakeCase(p)] = "";
                });
                worksheet = XLSX.utils.json_to_sheet([headers]);
            }

            XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);

        }

        const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });

        res.setHeader('Content-Disposition', `attachment; filename=Hawksyn_Template_${caseId || 'Master'}.xlsx`);
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');

        return res.send(buffer);

    } catch (error) {
        console.error('[DownloadTemplate Error]:', error);
        return res.status(500).json({ success: false, message: `Failed to generate template: ${error.message}`, error: error.message });
    }
};

exports.uploadPlaybook = async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ success: false, message: 'File is required.' });

        const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
        const summary = {};
        const parsedData = {};
        const errors = [];
        const sheetConfigs = {}; // Store matched configs for each sheet

        workbook.SheetNames.forEach(sheetName => {
            const baseNameOrig = sheetName.trim();
            const lowerName = baseNameOrig.toLowerCase();

            // SKIP Schema and Summary sheets
            if (lowerName.includes('summary') || lowerName.includes('schema')) {
                return;
            }

            let config = PLAYBOOK_MAPPING[baseNameOrig];

            if (!config) {
                // Strict Fuzzy Match: Only match exact short codes or well-formed prefixes
                const foundKey = Object.keys(PLAYBOOK_MAPPING).find(key => {
                    const shortCode = key.split('_')[1]; // Extracts 'CR' from '01_CR_(Case_Registry)'
                    const cleanBase = baseNameOrig.trim().toUpperCase();
                    
                    // 1. Exact match with original key
                    if (cleanBase === key.toUpperCase()) return true;
                    
                    // 2. Exact match with short code (e.g. "CR")
                    if (cleanBase === shortCode) return true;
                    
                    // 3. Exact match with the descriptive keyword inside parentheses (e.g. "Questions" from "05_MCQM_(Questions)")
                    const matchParens = key.match(/\(([^)]+)\)/);
                    const keyword = matchParens ? matchParens[1].toUpperCase().replace(/\s+/g, '_') : null;
                    
                    if (keyword && cleanBase === keyword) return true;
                    if (keyword && cleanBase.replace(/\s+/g, '_') === keyword) return true;

                    // 4. Prefix match & Split match
                    // Allow splitting (e.g. VLT_1, VLT_2, Questions_1) only for array-heavy models
                    const allowSplit = ['VLT', 'QST', 'DAST', 'EST', 'DRO', 'RCM', 'CDT', 'CCT', 'CST', 'RFT', 'MCQM', 'CT'].includes(shortCode);
                    
                    if (allowSplit) {
                        // Matches "VLT_1", "11 VLT", "VLT - Part 2"
                        const strictRegex = new RegExp(`^\\d*[\\s_]*${shortCode}([\\s_\\-]+\\w+.*|\\s*\\(.*)?$`);
                        if (strictRegex.test(cleanBase)) return true;
                        
                        // Matches "Questions_1", "Constraints_2"
                        if (keyword) {
                            // cleanBase might be "QUESTIONS_1" or "QUESTIONS 1"
                            const cleanBaseUnderscored = cleanBase.replace(/\s+/g, '_');
                            const keywordRegex = new RegExp(`^${keyword}([\\s_\\-]+\\w+.*)?$`);
                            if (keywordRegex.test(cleanBaseUnderscored)) return true;
                        }
                    } else {
                        // For singleton configs like CaseRegistry (CR), do not allow split suffixes like "CR_3"
                        const strictConfigRegex = new RegExp(`^\\d*[\\s_]*${shortCode}$`);
                        return strictConfigRegex.test(cleanBase);
                    }
                    
                    return false;
                });
                if (foundKey) config = PLAYBOOK_MAPPING[foundKey];
            }


            if (config) {
                console.log(`[Validation] Scanning: ${sheetName} -> ${config.model}`);
                const sheetData = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName]);
                parsedData[sheetName] = sheetData;
                sheetConfigs[sheetName] = config; // Store found config
                summary[sheetName] = sheetData.length;
            }
        });

        // 2. Perform Validation & Normalization
        Object.keys(parsedData).forEach(sheetName => {
            const config = sheetConfigs[sheetName];
            if (!config) return;

            // Robust baseName: Extracts 'CR' from '01_CR_(Case_Registry)' or '01 CR'
            const baseName = sheetName.split('_')[1] || sheetName.split(' ')[1] || sheetName;

            let rows = parsedData[sheetName];

            rows = rows.map((row, index) => {
                const rowNum = index + 2;
                
                // (0) Strip completely empty rows early
                const hasData = Object.values(row).some(v => v !== null && v !== undefined && String(v).trim() !== '');
                if (!hasData) return null;

                const normalizedRow = {};

                // (A) Normalize all keys to camelCase (e.g., question_id -> questionId, "CAT ID" -> catId)
                Object.keys(row).forEach(key => {
                    // 1. Convert to a placeholder underscore format (Replace spaces/dots with underscores)
                    let normalizedKey = key.trim().toLowerCase().replace(/[\s\.]+/g, '_');
                    // 2. Convert underscores to camelCase
                    const camelKey = normalizedKey.replace(/_([a-z0-9])/g, (g) => g[1].toUpperCase());
                    normalizedRow[camelKey] = row[key];
                });

                // (B) ID Alias Mapping (Enrich identifiers across models)
                normalizedRow.intentId = normalizedRow.intentId || normalizedRow.cimtId || normalizedRow.ciprId || normalizedRow.caseIntentId || normalizedRow.targetIntentId;
                normalizedRow.caseId = normalizedRow.caseId || normalizedRow.targetCaseId;

                // Model specific aliasing
                if (['Playbooks', 'CaseIntentConfig'].includes(config.model) || ['PR', 'PV', 'CP', 'CIMT'].includes(baseName)) {
                    normalizedRow.playbookId = normalizedRow.playbookId || normalizedRow.id;
                    normalizedRow.playbookVersionId = normalizedRow.playbookVersionId || normalizedRow.playbookVersion || normalizedRow.versionId || 'V1';
                }

                if (config.model === 'MandatoryObjectiveInput' || baseName === 'Questions') {
                    normalizedRow.moiId = normalizedRow.moiId || normalizedRow.id || normalizedRow.mandatoryInputId;
                }

                if (config.model === 'MoiQuestionMapping') {
                    normalizedRow.moiqmId = normalizedRow.moiqmId || normalizedRow.id || normalizedRow.mqmId;
                }

                if (baseName.includes('QST')) {
                    normalizedRow.mappingId = normalizedRow.mappingId || normalizedRow.scoringRuleId || normalizedRow.qstId || normalizedRow.id;
                    normalizedRow.cqmtId = normalizedRow.mappingId;
                }

                if (config.model === 'VerdictLogicTable' || baseName.includes('VLT')) {
                    const baseId = normalizedRow.ruleId || normalizedRow.vltId;
                    if (baseId) {
                        normalizedRow.ruleId = baseId;
                    } else if (normalizedRow.verdictLogicId) {
                        normalizedRow.ruleId = `${normalizedRow.verdictLogicId}_R${rowNum}`;
                    } else {
                        normalizedRow.ruleId = `${normalizedRow.ruleType || 'RULE'}_R${rowNum}`;
                    }
                    normalizedRow.verdictLogicId = normalizedRow.verdictLogicId || normalizedRow.ruleId;

                    // Map Taxonomy outcome/outcomeValue to Model actionType/actionValueJson
                    normalizedRow.actionType = normalizedRow.actionType || normalizedRow.outcomeType || normalizedRow.ruleType;
                    normalizedRow.actionValueJson = normalizedRow.actionValueJson || normalizedRow.outcomeValue || normalizedRow.outcomeValueJson;

                    // Normalize Stage (STAGE_1 -> 1)
                    if (typeof normalizedRow.stage === 'string' && normalizedRow.stage.includes('_')) {
                        const sParts = normalizedRow.stage.split('_');
                        const sNum = parseInt(sParts[sParts.length - 1]);
                        if (!isNaN(sNum)) normalizedRow.stage = sNum;
                    } else if (typeof normalizedRow.stage === 'string' && /^\d+$/.test(normalizedRow.stage)) {
                        normalizedRow.stage = parseInt(normalizedRow.stage);
                    }

                    // Default priority if missing
                    normalizedRow.priority = normalizedRow.priority || normalizedRow.stage || 1;
                }

                // Global identifier propagation
                normalizedRow.caseId = normalizedRow.caseId || normalizedRow.caseScope;
                normalizedRow.intentId = normalizedRow.intentId || normalizedRow.intentScope;

                if (baseName.includes('Contradiction')) {
                    normalizedRow.contradictionId = normalizedRow.contradictionId || normalizedRow.changeId || normalizedRow.id || `CONT_R${rowNum}`;
                }

                if (baseName.includes('GR') || config.model === 'GuardrailRegistry') {
                    normalizedRow.grRuleId = normalizedRow.grRuleId || normalizedRow.id || `GR_R${rowNum}`;
                    normalizedRow.ruleName = normalizedRow.ruleName || normalizedRow.grRuleId || `Rule ${rowNum}`;
                }

                if (baseName.includes('PCR') || config.model === 'PromptConfigRegistry') {
                    normalizedRow.promptId = normalizedRow.promptId || normalizedRow.id || `PRM_R${rowNum}`;
                }

                if (baseName.includes('DAST') || config.model === 'DecisionAssuranceSections') {
                    normalizedRow.sectionId = normalizedRow.sectionId || normalizedRow.id;
                    normalizedRow.sectionName = normalizedRow.sectionName || normalizedRow.sectionId || `Section ${rowNum}`;
                }

                if (baseName.includes('EST')) {
                    normalizedRow.signalId = normalizedRow.signalId || normalizedRow.estSignalId || normalizedRow.id || `SIG_R${rowNum}`;
                }

                // Ensure crtId for all CoverageRequirements records (including global CAT rows)
                if (config.model === 'CoverageRequirements') {
                    const currentId = normalizedRow.crtId || normalizedRow.crtid;
                    const hasValidCurrentId = currentId && (typeof currentId !== 'string' || currentId.trim() !== '');
                    if (!hasValidCurrentId) {
                        normalizedRow.crtId = normalizedRow.catId || normalizedRow.catid || normalizedRow.id || `GLOBAL_CAT_R${rowNum}`;
                    }
                }

                if (config.model === 'RiskConstraintMap') {
                    normalizedRow.constraintId = normalizedRow.constraintId || normalizedRow.triggerReferenceId || 'ALL';
                }

                // Custom Pivot for IntegrityEligibilityRules
                if (config.model === 'IntegrityEligibilityRules' || sheetName.includes('Integrity')) {
                    // Map IDs
                    normalizedRow.ierId = normalizedRow.ierId || normalizedRow.id || `IER_RO_R${rowNum}`;

                    // Map Integrity Status to State enum
                    if (normalizedRow.integrityStatus) {
                        const status = normalizedRow.integrityStatus.replace('_INTEGRITY', '').toUpperCase();
                        if (['COMPLETE', 'FULL', 'PARTIAL', 'MINIMAL'].includes(status)) {
                            normalizedRow.integrityState = status;
                        } else {
                            normalizedRow.integrityState = 'PARTIAL'; // Safe fallback
                        }
                    }

                    // Map Condition to Anchors Json
                    if (normalizedRow.eligibilityConditionJson && !normalizedRow.requiredAnchorsJson) {
                        normalizedRow.requiredAnchorsJson = normalizedRow.eligibilityConditionJson;
                    }

                    // Defaults for missing required model fields
                    if (normalizedRow.verdictDeliverable === undefined) normalizedRow.verdictDeliverable = true;
                    if (normalizedRow.accuracyThresholdMin === undefined) normalizedRow.accuracyThresholdMin = 0;
                    if (normalizedRow.accuracyThresholdMax === undefined) normalizedRow.accuracyThresholdMax = 100;
                }


                // (C) Check Required ID (after normalization and aliasing)
                let finalId = normalizedRow[config.idField];

                // Check if row only contains empty or null values across all schema paths
                const schemaPathsForCheck = Object.keys(db[config.model].schema.paths);
                const hasSchemaData = schemaPathsForCheck.some(key => {
                    const val = normalizedRow[key];
                    return val !== null && val !== undefined && String(val).trim() !== '';
                });

                if (!hasSchemaData) {
                    return null; // Skip rows that have no data matching the schema
                }

                // Global Fallback: Try ANY available identifier key
                if (!finalId || (typeof finalId === 'string' && finalId.trim().toUpperCase() === 'NULL')) {
                    finalId = normalizedRow.id || normalizedRow.uuid ||
                        normalizedRow.catId || normalizedRow.catid ||
                        normalizedRow.crtId || normalizedRow.crtid ||
                        normalizedRow.ruleId || normalizedRow.intentId;

                    // Only generate a GENERIC ID for logic/rule rows, NOT for CaseRegistry or Intents
                    if (!finalId && !['CaseRegistry', 'IntentTaxonomy', 'Playbooks'].includes(config.model)) {
                        finalId = `GENERIC_ID_R${rowNum}`;
                    }

                    // Set it back to the required field if we found something
                    if (finalId) {
                        normalizedRow[config.idField] = finalId;
                    }
                }

                if (!finalId || (typeof finalId === 'string' && finalId.trim().toUpperCase() === 'NULL')) {
                    // SKIP documentation sheets silently if ID is missing (summary/schema rows)
                    if (sheetName.toLowerCase().includes('summary') || sheetName.toLowerCase().includes('schema')) {
                        return null;
                    }
                    errors.push({
                        sheet: sheetName,
                        row: rowNum,
                        error: `Missing required ID: ${config.idField}. Available keys: ${Object.keys(normalizedRow).join(', ')}`
                    });
                }

                // (D) Normalize Booleans & Parse JSON fields & Handle NULL strings
                Object.keys(normalizedRow).forEach(key => {
                    let val = normalizedRow[key];

                    // Universal: Strip extra surrounding quotes if they exist
                    if (typeof val === 'string' && val.startsWith('"') && val.endsWith('"')) {
                        val = val.substring(1, val.length - 1).replace(/""/g, '"');
                        normalizedRow[key] = val;
                    }

                    // Global NULL handler
                    if (typeof val === 'string' && (val.trim().toUpperCase() === 'NULL' || val.trim() === '')) {
                        normalizedRow[key] = null;
                        return;
                    }


                    // Boolean Normalization (Only if it is a string)
                    if (typeof val === 'string') {
                        if (val.toLowerCase() === 'true') normalizedRow[key] = true;
                        if (val.toLowerCase() === 'false') normalizedRow[key] = false;
                    }


                    // JSON Field Parsing (Ending in Json or specific names)
                    const lowerKey = key.toLowerCase();
                    if (lowerKey.endsWith('json') || ['options', 'scoringmap', 'rules'].includes(lowerKey)) {
                        const originalValue = normalizedRow[key];
                        // If it's already an object/array or empty, skip parsing
                        if (!originalValue || typeof originalValue === 'object') return;

                        const parsed = parseSafeJson(originalValue);
                        normalizedRow[key] = parsed;

                        // If it's still a string and looks like JSON, it failed to parse correctly
                        if (typeof parsed === 'string' && (parsed.trim().startsWith('{') || parsed.trim().startsWith('['))) {
                            const isIntentionalNull = parsed.trim().toUpperCase() === 'NULL';
                            if (!isIntentionalNull) {
                                errors.push({ sheet: sheetName, row: rowNum, field: key, error: `Invalid JSON format: ${originalValue}` });
                            }
                        }
                    }
                });

                // (D2) Strict Type Validation against Model Schema
                const schemaPaths = db[config.model].schema.paths;
                Object.keys(normalizedRow).forEach(field => {
                    const val = normalizedRow[field];
                    const schemaType = schemaPaths[field];
                    if (!schemaType || val === null || val === undefined) return;

                    // 1. Number Validation
                    if (schemaType.instance === 'Number' && typeof val !== 'number') {
                        const parsedNum = Number(val);
                        if (isNaN(parsedNum)) errors.push({ sheet: sheetName, row: rowNum, field, error: `Value '${val}' must be a Number.` });
                        else normalizedRow[field] = parsedNum;
                    }

                    // 2. Boolean Validation
                    if (schemaType.instance === 'Boolean' && typeof val !== 'boolean') {
                        if (typeof val === 'string') {
                            const lowVal = val.toLowerCase();
                            if (['true', 'yes', '1', 'y'].includes(lowVal)) normalizedRow[field] = true;
                            else if (['false', 'no', '0', 'n'].includes(lowVal)) normalizedRow[field] = false;
                            else errors.push({ sheet: sheetName, row: rowNum, field, error: `Value '${val}' must be a Boolean.` });
                        } else errors.push({ sheet: sheetName, row: rowNum, field, error: `Value '${val}' must be a Boolean.` });
                    }

                    // 3. Enum Validation
                    if (schemaType.options && schemaType.options.enum) {
                        if (!schemaType.options.enum.includes(val)) {
                            errors.push({ sheet: sheetName, row: rowNum, field, error: `Value '${val}' is invalid. Allowed: ${schemaType.options.enum.join(', ')}` });
                        }
                    }
                });

                // (E) Skip rows that are clearly headers or documentation (missing sectionId/caseId)
                if (baseName.includes('OST') || baseName.includes('DAST') || baseName.includes('PCR')) {
                    if (!normalizedRow.sectionId || !normalizedRow.caseId) {
                        return null; // Skip chapter headers
                    }
                }

                return normalizedRow;
            }).filter(r => r !== null);

            parsedData[sheetName] = rows; // Update with normalized rows
        });

        // 3. Cross-Reference Validation
        if (parsedData['QST'] && parsedData['Constraints']) {
            const constraintIds = new Set(parsedData['Constraints'].map(c => c.constraintId));
            parsedData['QST'].forEach((mapping, idx) => {
                // If mapping has constraintId, check it
                if (mapping.constraintId && !constraintIds.has(mapping.constraintId)) {
                    errors.push({ sheet: 'QST', row: idx + 2, error: `Referenced constraintId ${mapping.constraintId} not found in Constraints sheet.` });
                }
            });
        }

        if (parsedData['QST'] && parsedData['Questions']) {
            const questionIds = new Set(parsedData['Questions'].map(q => q.questionId));
            parsedData['QST'].forEach((mapping, idx) => {
                if (mapping.questionId && !questionIds.has(mapping.questionId)) {
                    errors.push({ sheet: 'QST', row: idx + 2, error: `Referenced questionId ${mapping.questionId} not found in Questions sheet.` });
                }
            });
        }

        // 4. Trace Log & Audit
        const uploadId = uuidv4();
        tempStorage.set(uploadId, {
            summary,
            parsedData,
            sheetConfigs, // Persist config mappings for merging
            timestamp: Date.now()
        });

        // Set 30-minute expiry (Auto-cleanup to prevent memory leaks)
        setTimeout(() => {
            if (tempStorage.has(uploadId)) {
                tempStorage.delete(uploadId);
                console.log(`[UploadPlaybook] uploadId ${uploadId} expired and removed from memory.`);
            }
        }, 30 * 60 * 1000); // 30 minutes


        await createAuditLog(req, 'PLAYBOOK_UPLOAD_VALIDATE', null, {
            fileName: req.file.originalname,
            sheets: Object.keys(summary),
            rowCount: summary
        });

        console.log(`[UploadPlaybook] SUCCESS. uploadId: ${uploadId}`);

        return res.json({
            success: errors.length === 0,
            uploadId,
            summary,
            errors,
            preview: errors.length === 0 ? parsedData : null
        });

    } catch (error) {
        console.error('[UploadPlaybook Error]:', error);
        return res.status(500).json({ success: false, message: `Playbook parsing failed: ${error.message}`, error: error.message });
    }
};

/**
 * Confirm Import Data to MongoDB
 */
exports.confirmImport = async (req, res) => {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        const { uploadId, caseId } = req.body;
        if (!uploadId) return res.status(400).json({ success: false, message: 'uploadId is required.' });

        const cachedData = tempStorage.get(uploadId);
        if (!cachedData) return res.status(404).json({ success: false, message: 'Upload data not found or expired. Please upload again.' });

        const { parsedData, sheetConfigs } = cachedData;

        // Determine Case Context
        // Try all sheets for caseId, targetCaseId, or caseScope
        let targetCaseId = caseId;
        if (!targetCaseId) {
            for (const sheetName of Object.keys(parsedData)) {
                const rows = parsedData[sheetName];
                if (rows && Array.isArray(rows)) {
                    // Search all rows in this sheet for a caseId identifier
                    for (const row of rows) {
                        targetCaseId = row.targetCaseId || row.caseId || row.caseScope;
                        if (targetCaseId) break;
                    }
                }
                if (targetCaseId) break;
            }
        }

        if (!targetCaseId) {
            throw new Error('Case context (caseId) could not be determined from data or request body.');
        }

        console.log(`[Import] Starting bulk import for case: ${targetCaseId}. uploadId: ${uploadId}`);

        // 1. Group and Merge Data (Once per model across all sheets)
        const modelToDataMap = {}; // { ModelName: { idValue: consolidated_data } }
        const modelConfigs = {};   // { ModelName: config }

        Object.keys(parsedData).forEach(sheetName => {
            const config = sheetConfigs[sheetName];
            if (!config) return;

            if (!modelToDataMap[config.model]) {
                modelToDataMap[config.model] = {};
                modelConfigs[config.model] = config;
            }

            const rows = parsedData[sheetName];
            rows.forEach(row => {
                // Determine merge key: Use common identifiers for consolidated models
                let mergeKey = row[config.idField];
                if (config.model === 'CaseIntentConfig' && row.intentId) {
                    mergeKey = row.intentId;
                } else if (config.model === 'Questions' && row.questionId) {
                    mergeKey = row.questionId;
                } else if (config.model === 'Constraints' && row.constraintId) {
                    mergeKey = row.constraintId;
                } else if (config.model === 'CoverageRequirements' && row.crtId && row.crtId.trim() !== '') {
                    mergeKey = row.crtId;
                }

                if (!mergeKey) return;

                // MERGE: Row-wise attribute union for shared models (e.g. CIMT+CIPR, MCQM+QST)
                if (!modelToDataMap[config.model][mergeKey]) {
                    modelToDataMap[config.model][mergeKey] = row;
                } else {
                    modelToDataMap[config.model][mergeKey] = { ...modelToDataMap[config.model][mergeKey], ...row };
                }


                // Propagate missing ID context globally during merge
                modelToDataMap[config.model][mergeKey].caseId = modelToDataMap[config.model][mergeKey].caseId || row.caseId || targetCaseId;
                modelToDataMap[config.model][mergeKey].intentId = modelToDataMap[config.model][mergeKey].intentId || row.intentId || 'ALL';

                // SPECIAL PIVOT: Constraints Band Mapping (CTT sheets provide rows per band)
                if (config.model === 'Constraints' && row.bandName) {
                    const band = row.bandName.toUpperCase();
                    const target = modelToDataMap[config.model][mergeKey];
                    if (band === 'CRITICAL') { target.criticalMin = row.minScore; target.criticalMax = row.maxScore; }
                    else if (band === 'FRAGILE') { target.fragileMin = row.minScore; target.fragileMax = row.maxScore; }
                    else if (band === 'MODERATE') { target.moderateMin = row.minScore; target.moderateMax = row.maxScore; }
                    else if (band === 'STRONG') { target.strongMin = row.minScore; target.strongMax = row.maxScore; }

                    // Propagate missing ID context if CTT is processed before CT
                    target.caseId = target.caseId || row.caseId;
                    target.intentId = target.intentId || row.intentId;
                }

                // SPECIAL PIVOT: CoverageRequirements (CAT sheet rows provide missing/partial values separately)
                if (config.model === 'CoverageRequirements' && row.gapType) {
                    const type = (row.gapType || '').toUpperCase();
                    const target = modelToDataMap[config.model][mergeKey];
                    if (type === 'MISSING') {
                        target.missingPenaltyPoints = row.penaltyPoints || target.missingPenaltyPoints;
                    } else if (type === 'PARTIAL') {
                        target.partialPenaltyPoints = row.penaltyPoints || target.partialPenaltyPoints;
                    }
                }
            });
        });

        // 1.5 Final Pivoting and Normalization before conversion to arrays
        for (const mName in modelToDataMap) {
            if (mName === 'Questions') {
                Object.keys(modelToDataMap[mName]).forEach(mergeKey => {
                    const q = modelToDataMap[mName][mergeKey];
                    // Build optionsJson
                    if (!q.optionsJson || (Array.isArray(q.optionsJson) && q.optionsJson.length === 0)) {
                        const opts = [];
                        if (q.optionA) opts.push({ id: 'A', opt: q.optionA, score: q.optionAScore || 0 });
                        if (q.optionB) opts.push({ id: 'B', opt: q.optionB, score: q.optionBScore || 0 });
                        if (q.optionC) opts.push({ id: 'C', opt: q.optionC, score: q.optionCScore || 0 });
                        if (q.optionD) opts.push({ id: 'D', opt: q.optionD, score: q.optionDScore || 0 });
                        if (opts.length > 0) q.optionsJson = opts;
                    }
                    // Ensure boolean conversion for Excel
                    if (q.isActive === undefined) q.isActive = true;
                });
            }

            if (mName === 'Contradictions') {
                Object.keys(modelToDataMap[mName]).forEach(mergeKey => {
                    const c = modelToDataMap[mName][mergeKey];
                    // CCT Logic mapping
                    if (c.ruleJson && typeof c.ruleJson === 'string') c.ruleJson = parseSafeJson(c.ruleJson);
                    if (c.involvedEntitiesJson && typeof c.involvedEntitiesJson === 'string') c.involvedEntitiesJson = parseSafeJson(c.involvedEntitiesJson);
                });
            }

            if (mName === 'RedFlagTaxonomy') {
                Object.keys(modelToDataMap[mName]).forEach(mergeKey => {
                    const f = modelToDataMap[mName][mergeKey];
                    if (f.triggerConditionJson && typeof f.triggerConditionJson === 'string') f.triggerConditionJson = parseSafeJson(f.triggerConditionJson);
                });
            }
        }


        // Convert back to arrays for insertion
        const modelToInsertData = {};
        for (const mName in modelToDataMap) {
            modelToInsertData[mName] = Object.values(modelToDataMap[mName]);
        }

        // 2. Clear Existing Records (Scoped by identifiers)
        const keyToCheck = [
            'rcmId', 'crtId', 'cqmtId', 'elrId', 'moiId', 'moiqmId',
            'ruleId', 'dependencyRuleId', 'redFlagId', 'intentId', 'playbookVersionId', 'playbookId', 'grRuleId', 'promptId', 'scoringRuleId',
            'droId', 'sectionId', 'caseId', 'questionId', 'warningId', 'warningMappingId', 'contradictionId',
            'constraintId', 'cttId', 'accuracyPolicyId', 'signalId', 'sourceId', 'patternKeyId', 'ierId', 'schemaId', 'pcrPromptId'
        ];

        for (const modelName of Object.keys(modelToInsertData)) {
            const Model = db[modelName];
            console.log(`[Import] Clearing old records for ${modelName} (Case: ${targetCaseId})`);

            const query = {};
            const recordsToImportArray = modelToInsertData[modelName];
            const config = modelConfigs[modelName];
            const primaryIds = recordsToImportArray.map(r => r[config.idField]).filter(id => id);

            // (E) CLEAR OLD RECORDS: Use the most specific identifier available
            // Priority 1: Clear by sheet-specific primary idField if it exists on the model path
            const primaryIdKey = config.idField;
            if (primaryIdKey && Model.schema.paths[primaryIdKey]) {
                query[primaryIdKey] = { $in: primaryIds };
            } else {
                // Priority 2: Clear by exhaustive global identifier list to prevent collisions
                for (const key of keyToCheck) {
                    if (Model.schema.paths[key] && !query[key]) {
                        query[key] = { $in: primaryIds };
                        break;
                    }
                }
            }

            // Priority 2: Case Scoping Fallback (Only use if no primary IDs found)
            if (Object.keys(query).length === 0) {
                if (Model.schema.paths.caseId) query.caseId = targetCaseId;
                else if (Model.schema.paths.caseScope) query.caseScope = targetCaseId;
                else if (Model.schema.paths.targetCaseId) query.targetCaseId = targetCaseId;
            }

            try {
                if (Object.keys(query).length > 0) {
                    console.log(`[Import] Executing clean-up query for ${modelName}: ${JSON.stringify(query)}`);
                    await Model.deleteMany(query).session(session);
                }
            } catch (delErr) {
                console.warn(`[Import] Deletion skipped for ${modelName}: ${delErr.message}`);
            }
        }

        // 3. Perform Consolidated Bulk Inserts & Auto-Mapping for Questions
        for (const modelName of Object.keys(modelToInsertData)) {
            const Model = db[modelName];
            const consolidatedRecords = modelToInsertData[modelName];

            if (consolidatedRecords.length > 0) {
                console.log(`[Import] Inserting ${consolidatedRecords.length} merged records into ${modelName}`);
                await Model.insertMany(consolidatedRecords, { session });

                // (A) AUTO-MAPPING: If this was the Questions model and rows have moiId, create MoiQuestionMapping rows too
                if (modelName === 'Questions') {
                    const mappingRows = consolidatedRecords
                        .filter(r => r.moiId) // Only rows that have a mapping target
                        .map((r, idx) => ({
                            moiqmId: `MQM_AUTO_${r.questionId}_${idx}`,
                            moiId: r.moiId,
                            questionId: r.questionId,
                            displayOrder: r.displayOrder || idx + 1,
                            accuracyImpactFlag: r.accuracyImpactFlag || null,
                            isActive: true
                        }));

                    if (mappingRows.length > 0) {
                        console.log(`[Import] Auto-creating ${mappingRows.length} mappings in MoiQuestionMapping`);
                        // Clean up existing mappings for these IDs first to prevent duplicates
                        const mappingIds = mappingRows.map(m => m.moiqmId);
                        await db.MoiQuestionMapping.deleteMany({
                            $or: [
                                { moiqmId: { $in: mappingIds } },
                                { questionId: { $in: mappingRows.map(m => m.questionId) }, moiId: { $in: mappingRows.map(m => m.moiId) } }
                            ]
                        }).session(session);

                        await db.MoiQuestionMapping.insertMany(mappingRows, { session });
                    }
                }
            }
        }

        await session.commitTransaction();
        session.endSession();
        tempStorage.delete(uploadId); // Cleanup

        await createAuditLog(req, 'PLAYBOOK_IMPORT_CONFIRM', null, {
            caseId: targetCaseId,
            uploadId,
            sheetsProcessed: Object.keys(parsedData)
        });

        console.log(`[Import] SUCCESS for case: ${targetCaseId}`);

        return res.json({
            success: true,
            message: `Playbook imported successfully for case ${targetCaseId}.`,
            rowsInserted: cachedData.summary
        });

    } catch (error) {
        await session.abortTransaction();
        session.endSession();
        console.error('[ConfirmImport Error]:', error);
        return res.status(500).json({ success: false, message: `Playbook import failed: ${error.message}`, error: error.message });
    }
};

/**
 * Get Case Snapshot (Admin Overview)
 * GET /api/v1/admin/playbook/case/:caseId/snapshot
 */
exports.getCaseSnapshot = async (req, res) => {
    try {
        const { caseId } = req.params;

        // 1. Fetch Core Case Info
        const registry = await db.CaseRegistry.findOne({ caseId }).lean();
        if (!registry) return res.status(404).json({ success: false, message: 'Case not found.' });

        // 2. Fetch Intents & Mapping
        const intentConfigs = await db.CaseIntentConfig.find({ caseId }).sort({ displayOrder: 1 }).lean();
        const intentIds = intentConfigs.map(ic => ic.intentId);
        const intents = await db.IntentTaxonomy.find({ intentId: { $in: intentIds } }).lean();

        // 3. Fetch Policies (Playbooks)
        const policies = await db.Playbooks.find({ caseId }).lean();

        // 4. Fetch Detailed Data for Snapshot
        const questions = await db.Questions.find({ caseScope: { $in: [caseId, 'ALL'] } }).select('questionId questionText').lean();
        const constraints = await db.Constraints.find({ caseId: { $in: [caseId, 'ALL'] } }).select('constraintId constraintName').lean();
        const redFlags = await db.RedFlagTaxonomy.find({ caseId: { $in: [caseId, 'ALL'] } }).select('redFlagId redFlagName').lean();
        const contradictions = await db.Contradictions.find({ caseId: { $in: [caseId, 'ALL'] } }).select('contradictionId contradictionName').lean();
        const externalSignals = await db.ExternalSignalTaxonomy.find({ caseId: { $in: [caseId, 'ALL'] } }).select('signalId signalName').lean();

        // 5. Structure Snapshot Result
        const snapshot = {
            caseInfo: registry,
            intents: intentConfigs.map(config => {
                const baseIntent = intents.find(i => i.intentId === config.intentId);
                const policy = policies.find(p => p.intentId === config.intentId || p.intentId === 'ALL');
                return {
                    intentId: config.intentId,
                    name: baseIntent ? baseIntent.intentName : 'Unknown',
                    isActive: config.isActive,
                    isDefault: config.isDefault,
                    playbookVersion: config.playbookVersionId,
                    policy: policy ? {
                        llm: policy.normalisationLlm,
                        docMandatory: policy.documentMandatory,
                        adversarialMirror: policy.adversarialMirrorEnabled
                    } : null
                };
            }),
            details: {
                questions: questions,
                constraints: constraints,
                redFlags: redFlags,
                contradictions: contradictions,
                externalSignals: externalSignals
            },
            stats: {
                totalQuestions: questions.length,
                totalConstraints: constraints.length,
                totalRedFlags: redFlags.length,
                totalContradictions: contradictions.length,
                totalExternalSignals: externalSignals.length
            },
            readiness: {
                hasQuestions: questions.length > 0,
                hasConstraints: constraints.length > 0,
                hasLogic: redFlags.length > 0 && contradictions.length > 0
            }
        };

        return res.json({ success: true, data: snapshot });

    } catch (error) {
        console.error('[GetCaseSnapshot Error]:', error);
        return res.status(500).json({ success: false, message: 'Error fetching case snapshot.', error: error.message });
    }
};

