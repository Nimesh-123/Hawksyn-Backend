const { Worker } = require('bullmq');
const { connection } = require('./cvQueue');
const { db } = require('../models/index.model');
const { smartCVParser } = require('../../utils/aiParser');
const { deleteFile } = require('../../utils/s3');
const notificationService = require('../services/notificationService');
const { createAuditLog } = require('../../utils/auditLogger');
const { calculateAICost, convertToLocalCurrency } = require('../modules/admin/helpers/aiCostHelper');
const { detectRegionFromIP } = require('../../utils/regionHelper');

// Helper to fetch buffer from S3/URL
async function fetchFileBuffer(url) {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Failed to fetch file from ${url}`);
    const arrayBuffer = await response.arrayBuffer();
    return Buffer.from(arrayBuffer);
}

const worker = new Worker('cvParsingQueue', async (job) => {
    const { runId, userId, originalname, mimetype, fileUrl, fileName, ip } = job.data;
    
    console.log(`[Queue] Processing CV for Run: ${runId}`);
    
    // Mock req object for createAuditLog since we are out of express context
    const mockReq = { ip: ip || '122.161.48.0', user: { id: userId } };

    try {
        const fileBuffer = await fetchFileBuffer(fileUrl);
        await createAuditLog(mockReq, 'CV_PARSING_STARTED', userId, { runId, fileName: originalname });
        
        let extractedData = await smartCVParser(fileBuffer, originalname, mimetype, userId, fileUrl);
        let parserStatus = "FAILED";

        if (extractedData && extractedData.isCv === false) {
            await deleteFile(fileName);
            await db.DocumentUploads.findOneAndUpdate(
                { userId, isActive: true },
                {
                    $set: {
                        cvUrl: null,
                        parsedCvData: null,
                        parserStatus: 'NOT_A_CV',
                        errorReason: 'Detected as non-CV document.',
                        isActive: false
                    }
                }
            );
            await createAuditLog(mockReq, 'CV_PARSING_REJECTED', userId, { runId, fileName: originalname, reason: 'Not a valid Resume/CV' });
            return { success: false, reason: 'NOT_A_CV' };
        }

        if (extractedData) {
            try {
                const { sanitizeParsedData } = require('../modules/cv/helpers/cvSanitizer.js');
                extractedData = sanitizeParsedData(extractedData);
                parserStatus = "SUCCESS";
            } catch (e) {
                parserStatus = "SUCCESS";
            }
        }

        const isExtractionBlank = !extractedData || 
            (extractedData.aeuList.length < 3 && 
             (!extractedData.structured.work?.experience?.length) && 
             (!extractedData.structured.composition?.skills?.technical?.length));

        if (isExtractionBlank && parserStatus !== "FAILED") {
            parserStatus = "EMPTY";
            await createAuditLog(mockReq, 'CV_PARSING_EMPTY', userId, { runId, fileName: originalname, reason: 'No meaningful data extracted' });
        }

        const dbSafeParsedData = extractedData ? JSON.parse(JSON.stringify(extractedData)) : null;

        const newCv = await db.DocumentUploads.findOneAndUpdate(
            { userId, isActive: true },
            {
                $set: {
                    parsedCvData: dbSafeParsedData,
                    parserStatus: parserStatus,
                    parserMetadata: extractedData ? {
                        llm: extractedData.llm,
                        model: extractedData.model,
                        modelUsed: extractedData.modelUsed,
                        duration: extractedData.totalPipelineDuration || extractedData.parsingDuration,
                        tokenUsage: extractedData.tokenUsage
                    } : null
                }
            },
            { new: true }
        );

        await db.Runs.findOneAndUpdate(
            { runId },
            {
                $set: {
                    status: 'CV_UPLOADED',
                    'cvSnapshot.cvUploadId': newCv._id,
                    'cvSnapshot.cvUrl': newCv.cvUrl,
                    'cvSnapshot.parsedData': newCv.parsedCvData,
                    'cvSnapshot.attachedAt': new Date(),
                    'cvSnapshot.source': 'REUPLOADED'
                }
            }
        );

        await db.UserProfile.findOneAndUpdate(
            { userId },
            {
                $set: {
                    lastCvUploadId: newCv._id,
                    cvUrl: newCv.cvUrl,
                    originalParsedData: newCv.parsedCvData,
                    confirmedProfile: null,
                    isConfirmed: false
                }
            },
            { upsert: true }
        );

        if (parserStatus === "SUCCESS") {
            const user = await db.User.findById(userId);
            if (user) await notificationService.notifyParsingComplete(runId, user);
        }

        return { success: true, parserStatus };

    } catch (error) {
        console.error(`[Queue] Failed processing runId: ${runId}`, error);
        
        if (error.name === 'GuardrailError') {
            await deleteFile(fileName);
            await createAuditLog(mockReq, 'CV_PARSING_REJECTED', userId, {
                runId,
                fileName: originalname,
                reason: error.userMessage
            });
            throw error; // Let BullMQ handle failure state
        }

        await createAuditLog(mockReq, 'CV_PARSING_FAILED', userId, {
            runId,
            fileName: originalname,
            error: error.message
        });
        throw error; // Rethrow to trigger BullMQ retries
    }
}, {
    connection,
    concurrency: 15 // LIMIT TO 15 CONCURRENT GEMINI REQUESTS!
});

worker.on('completed', (job) => {
    console.log(`[Queue] Job ${job.id} completed successfully for runId: ${job.data.runId}`);
});

worker.on('failed', (job, err) => {
    console.error(`[Queue] Job ${job.id} failed for runId: ${job.data.runId} - ${err.message}`);
});

module.exports = worker;
