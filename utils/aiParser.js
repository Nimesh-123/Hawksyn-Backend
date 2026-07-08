const mongoose = require('mongoose');
const pdf = require('pdf-parse');
const mammoth = require('mammoth');
const { runGuardrails } = require('../src/services/guardrails');
const { runExtractionPipeline } = require('../src/services/extraction');
const DocumentUploads = require('../src/modules/cv/DocumentUploads.model');
const ExtractedCV = require('../src/modules/cv/ExtractedCV.model');

class GuardrailError extends Error {
    constructor(rejection) {
        super(rejection.userMessage);
        this.name = 'GuardrailError';
        this.ruleId = rejection.ruleId;
        this.layer = rejection.layer;
        this.userMessage = rejection.userMessage;
        this.remediationAction = rejection.remediationAction;
    }
}

/**
 * Clean CV text for better parsing efficiency (Kept for backwards compatibility)
 */
function cleanCVText(text) {
    if (!text) return "";
    return text
        .replace(/\s+/g, " ")
        .replace(/Page \d+/gi, "")
        .trim();
}

/**
 * Extract text from file (PDF or DOCX) (Kept for backwards compatibility)
 */
const extractTextFromFile = async (buffer, mimetype) => {
    try {
        let result = "";
        if (mimetype === 'application/pdf') {
            const data = await pdf(buffer);
            result = data.text;
        } else if (mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
            const { value } = await mammoth.extractRawText({ buffer });
            result = value;
        } else {
            throw new Error(`Unsupported file type: ${mimetype}`);
        }
        return result;
    } catch (error) {
        console.error("File Extraction Error:", error);
        throw new Error("Failed to extract text: " + error.message);
    }
};

/**
 * Neural Text Healer: Collapses noise and fixes whitespace (Kept for backwards compatibility)
 */
const neuralHealer = (text) => {
    if (!text) return "";
    return text
        .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "") 
        .replace(/\s{2,}/g, " ") 
        .trim();
};

/**
 * Map new multi-stage pipeline ExtractedCV schema outputs back to Hawksyn Standardised format.
 */
const mapNewPipelineToHawksyn = (inputDoc) => {
    if (!inputDoc) return null;
    
    // Ensure we are working with a plain JS object, not a Mongoose document wrapper
    const doc = inputDoc.toObject ? inputDoc.toObject() : inputDoc;

    const consolidatorOutput = doc.consolidator_output || {};
    const stats = doc.precomputed_stats || {};

    // 1. Reconstruct aeuList
    const aeuList = [];
    (doc.base_aeus || []).forEach(b => {
        aeuList.push({
            id: b.aue_id || `R${b.role_index || 1}_AEU${Math.random().toString(36).substr(2, 9)}`,
            pillar: 'work',
            fact: `${b.action || ''} at ${b.company || ''}`,
            isInferred: false,
            confidenceScore: b.evidence_strength === 'strong' ? 1.0 : (b.evidence_strength === 'moderate' ? 0.8 : 0.6),
            raw_text: b.raw_text,
            normalized_text: b.normalized_text
        });
    });

    const inferenceAeus = consolidatorOutput.inference_aeus || [];
    inferenceAeus.forEach(i => {
        aeuList.push({
            id: i.iaeu_id || `I_${Math.random().toString(36).substr(2, 9)}`,
            pillar: 'inferred',
            fact: `${i.title || i.type || ''}: ${i.inferred_claim || ''}`,
            isInferred: true,
            confidenceScore: i.confidence === 'high' ? 1.0 : (i.confidence === 'medium' ? 0.7 : 0.4),
            inferenceReason: i.logic || ''
        });
    });

    // 2. Reconstruct Work Experience
    const experience = (doc.roles || []).map(role => {
        const title = role.role_metadata?.title || '';
        const company = role.role_metadata?.company || '';
        const duration = `${role.role_metadata?.start_date || ''} - ${role.role_metadata?.end_date || ''}`;
        const descriptionLines = (role.base_aeus || []).map(aeu => aeu.normalized_text || aeu.raw_text || aeu.action).filter(Boolean);
        
        return {
            title,
            company,
            duration,
            description: descriptionLines.length > 0 ? '• ' + descriptionLines.join('\n• ') : ""
        };
    });

    // 3. Reconstruct Projects
    const projects = doc.skills?.projects || consolidatorOutput.projects || [];
    const formattedProjects = (projects || []).map(p => {
        let desc = p.description || "";
        if (desc && typeof desc === 'string' && desc.includes('\n')) {
            desc = desc.split('\n').map(line => {
                const trimmed = line.trim();
                if (!trimmed) return "";
                if (trimmed.startsWith('•') || trimmed.startsWith('-') || trimmed.startsWith('*')) return trimmed;
                return '• ' + trimmed;
            }).join('\n');
        } else if (desc && typeof desc === 'string' && desc.length > 100) {
            if (!desc.trim().startsWith('•')) {
                desc = '• ' + desc.trim();
            }
        }
        return {
            title: p.title || p.name || "",
            description: desc,
            technologies: p.technologies || p.tech_stack || []
        };
    });

    // 4. Skills (Technical vs Soft)
    const technicalSkills = new Set();
    const softSkills = new Set();
    const languagesSpoken = new Set();
    
    let skillEntries = [];
    if (Array.isArray(doc.skills)) {
        skillEntries = doc.skills;
    } else if (doc.skills && Array.isArray(doc.skills.skills)) {
        skillEntries = doc.skills.skills;
    } else if (doc.extracted_cv && Array.isArray(doc.extracted_cv.skills)) {
        skillEntries = doc.extracted_cv.skills;
    }
    
    console.log("DEBUG SKILLS:", {
        isArrayDocSkills: Array.isArray(doc.skills),
        hasDocSkillsSkills: doc.skills && Array.isArray(doc.skills.skills),
        hasExtractedCvSkills: doc.extracted_cv && Array.isArray(doc.extracted_cv.skills),
        skillEntriesLength: skillEntries.length,
        sampleSkill: skillEntries[0]
    });
    
    let softSkillsArr = [];
    if (doc.skills && Array.isArray(doc.skills.soft_skills)) {
        softSkillsArr = doc.skills.soft_skills;
    } else if (doc.extracted_cv && Array.isArray(doc.extracted_cv.soft_skills)) {
        softSkillsArr = doc.extracted_cv.soft_skills;
    }
    
    skillEntries.forEach(s => {
        const cat = (s.category || "").toLowerCase();
        if (cat === 'soft') {
            softSkills.add(s.skill_name);
        } else if (cat === 'language' || cat === 'languages') {
            languagesSpoken.add(s.skill_name);
        } else {
            technicalSkills.add(s.skill_name);
        }
    });
    
    if (Array.isArray(softSkillsArr)) {
        softSkillsArr.forEach(s => softSkills.add(s));
    }

    if (Array.isArray(consolidatorOutput.skill_mappings)) {
        consolidatorOutput.skill_mappings.forEach(s => {
            if (s.primary_skill && !languagesSpoken.has(s.primary_skill)) technicalSkills.add(s.primary_skill);
            if (Array.isArray(s.secondary_skills)) {
                s.secondary_skills.forEach(ss => {
                    if (!languagesSpoken.has(ss)) technicalSkills.add(ss);
                });
            }
        });
    }

    const seniorityInference = inferenceAeus.find(i => 
        i.type?.toLowerCase() === 'seniority' || 
        i.title?.toLowerCase().includes('seniority')
    );
    const senioritySummary = seniorityInference?.inferred_claim || stats.seniority_summary || "";

    const durationSec = doc.extraction_meta?.processing_duration_ms 
        ? `${(doc.extraction_meta.processing_duration_ms / 1000).toFixed(1)}s` 
        : (doc.extraction_meta?.validation_meta?.processing_duration_ms ? `${(doc.extraction_meta.validation_meta.processing_duration_ms / 1000).toFixed(1)}s` : "0.0s");

    return {
        candidate_id: doc.candidate_id,
        aeuList,
        structured: {
            identity: doc.header?.identity || consolidatorOutput.identity || doc.header || {},
            work: {
                experience,
                projects: formattedProjects
            },
            composition: {
                education: doc.education || [],
                skills: {
                    technical: Array.from(technicalSkills),
                    soft: Array.from(softSkills)
                },
                languagesSpoken: Array.from(languagesSpoken).length > 0 ? Array.from(languagesSpoken) : (consolidatorOutput.languages || []),
                certifications: (Array.isArray(doc.credentials) ? doc.credentials : doc.credentials?.certifications) || consolidatorOutput.certifications || [],
                senioritySummary
            },
            inferred: {
                seniorityLevel: seniorityInference?.title || (seniorityInference?.inferred_claim ? seniorityInference.inferred_claim.split(':')[0] : "") || stats.seniority_level || "",
                totalExperienceYears: stats.total_experience_years || 0,
                employmentStatus: stats.employment_status || "",
                industry: stats.industry || "",
                domainIndicator: stats.domain_indicator || "",
                sector: stats.sector || "",
                highestEducationLevel: stats.highest_education_level || "",
                seniorityConfidence: 0.9,
                senioritySummary
            }
        },
        parsingDuration: durationSec,
        llm: 'Gemini',
        model: 'Flash/Pro Hybrid',
        modelUsed: 'Gemini Flash & Pro Hybrid Pipeline',
        isCv: true,
        flags: { 
            isInputTruncated: doc.extraction_meta?.original_char_count > 100000, 
            isOutputTruncated: false 
        }
    };
};

/**
 * High-Accuracy Smart CV Parser leveraging advanced Guardrails and Multi-Stage extraction.
 */
const smartCVParser = async (buffer, fileName, mimetype, userId = null, fileUrl = null) => {
    console.log(`[AI Parser] Initiating new pipeline for ${fileName} | User ID: ${userId}`);

    // 1. Invoke Guardrails
    const guardrailResult = await runGuardrails({
        buffer,
        originalname: fileName,
        size: buffer.length,
        mimetype
    });

    if (!guardrailResult.pass) {
        console.warn(`[AI Parser] ❌ Guardrails rejected upload. Rule ID: ${guardrailResult.ruleId} | Layer: ${guardrailResult.layer}`);
        
        // Log rejection in DocumentUploads for audit compliance
        await DocumentUploads.create({
            userId: userId,
            fileName: fileName,
            cvUrl: fileUrl || null,
            parserStatus: 'rejected',
            rejection_rule_id: guardrailResult.ruleId,
            rejection_layer: guardrailResult.layer,
            user_message: guardrailResult.userMessage,
            file_name_original: fileName,
            file_size_bytes: buffer.length,
            file_format: mimetype === 'application/pdf' ? 'pdf' : 'docx',
            isActive: false
        });

        throw new GuardrailError(guardrailResult);
    }

    // Deactivate previous uploads first to avoid unique index conflict
    if (userId) {
        await DocumentUploads.updateMany({ userId, isActive: true }, { isActive: false });
    }

    // 2. Log Accepted status in DocumentUploads
    await DocumentUploads.create({
        userId: userId,
        fileName: fileName,
        cvUrl: fileUrl,
        parserStatus: 'accepted',
        file_name_original: fileName,
        file_size_bytes: buffer.length,
        file_format: mimetype === 'application/pdf' ? 'pdf' : 'docx',
        page_count: guardrailResult.pageCount,
        char_count: guardrailResult.charCount,
        full_text: guardrailResult.rawText,
        isActive: true
    });

    // 3. Synchronously run the new multi-stage extraction pipeline
    console.log(`[AI Parser] Guardrails passed. Executing runExtractionPipeline synchronously...`);
    const pipelineResult = await runExtractionPipeline(userId, guardrailResult.rawText, mongoose.connection.db);

    if (!pipelineResult.success) {
        console.error(`[AI Parser] ❌ Extraction pipeline execution failed: ${pipelineResult.error || pipelineResult.reason}`);
        throw new Error(pipelineResult.error || pipelineResult.reason || "Extraction pipeline failure.");
    }

    // 4. Fetch the completed ExtractedCV document
    console.log(`[AI Parser] Extraction completed successfully. Loading ExtractedCV document...`);
    const extractedDoc = await ExtractedCV.findOne({ candidate_id: userId });
    if (!extractedDoc) {
        throw new Error(`Failed to retrieve extracted CV data for User ID: ${userId}`);
    }

    // 5. Map the document back to the Hawksyn legacy structure
    return mapNewPipelineToHawksyn(extractedDoc);
};

module.exports = {
    smartCVParser,
    extractTextFromFile,
    cleanCVText,
    neuralHealer,
    GuardrailError
};
