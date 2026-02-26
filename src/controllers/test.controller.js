const { uploadFile } = require('../../utils/s3');
const RESPONSE = require('../../utils/response');
const { parseWithOpenAI, extractTextFromFile, cleanCVText } = require('../../utils/aiParser');

const MAX_CHARS = 5000;

exports.testUpload = async (req, res) => {
    try {
        if (!req.file) {
            return RESPONSE.error(res, 400, 1002, "No file uploaded");
        }

        const fileName = `test/${Date.now()}-${req.file.originalname}`;

        console.log(`[Turbo Mode] Starting S3 upload and Parallel OpenAI extraction...`);
        const startTime = Date.now();

        // Supported MimeTypes
        const allowedMimes = [
            'application/pdf',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document' // DOCX
        ];

        if (!allowedMimes.includes(req.file.mimetype)) {
            return RESPONSE.error(res, 400, 1003, `Unsupported file type: ${req.file.mimetype}. Only PDF and DOCX are allowed.`);
        }

        // RUN IN PARALLEL for maximum speed
        const [fileUrl, extractedData] = await Promise.all([
            uploadFile(req.file.buffer, fileName, req.file.mimetype),
            (async () => {
                // 1. Extract text ONCE (Handles PDF and DOCX)
                const rawText = await extractTextFromFile(req.file.buffer, req.file.mimetype);

                // 2. Aggressive Cleaning
                const cleanedText = cleanCVText(rawText);

                // 3. Hard Input size cap
                const trimmedText = cleanedText.length > MAX_CHARS
                    ? cleanedText.slice(0, MAX_CHARS)
                    : cleanedText;

                // 4. Use OpenAI Parallel Mode
                return await parseWithOpenAI(trimmedText, fileName);
            })()
        ]);

        const totalDuration = ((Date.now() - startTime) / 1000).toFixed(2) + 's';
        console.log(`[Turbo Mode] Finished everything in ${totalDuration}`);

        // CLEAN extractedData for cleaner response (Remove redundant performance fields)
        const perfData = {
            totalResponseTime: totalDuration,
            aiModelTime: extractedData ? extractedData.parsingDuration : null,
            modelUsed: extractedData ? extractedData.modelUsed : 'FAILED'
        };

        if (extractedData) {
            delete extractedData.parsingDuration;
            delete extractedData.modelUsed;
            delete extractedData.totalPipelineDuration;
        }

        return RESPONSE.success(res, 200, 1001, {
            message: "File uploaded and parsed successfully",
            file: {
                url: fileUrl,
                key: fileName,
                mimetype: req.file.mimetype
            },
            performance: perfData,
            extractedData: extractedData
        });
    } catch (err) {
        console.error("[Turbo Mode Error]:", err.message);
        return RESPONSE.error(res, 500, 9999, err.message);
    }
};
