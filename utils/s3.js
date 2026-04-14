const { S3Client, PutObjectCommand, DeleteObjectCommand, GetObjectCommand } = require("@aws-sdk/client-s3");
const { Upload } = require("@aws-sdk/lib-storage");
const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");

const s3Client = new S3Client({
    region: process.env.AWS_REGION,
    credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    },
});

const bucketName = process.env.AWS_S3_BUCKET_NAME;

/**
 * Upload a file to S3
 * @param {Buffer | ReadableStream | string} file - The file content
 * @param {string} fileName - The name of the file
 * @param {string} contentType - The MIME type of the file
 * @param {string} folder - Optional folder prefix
 * @returns {Promise<Object>} - S3 URL and Key info
 */
const uploadFile = async (file, fileName, contentType, folder = '') => {
    try {
        const key = folder ? `${folder}/${fileName}` : fileName;
        const upload = new Upload({
            client: s3Client,
            params: {
                Bucket: bucketName,
                Key: key,
                Body: file,
                ContentType: contentType,
            },
        });

        const result = await upload.done();
        return {
            success: true,
            key: key,
            bucket: bucketName,
            url: result.Location || `https://${bucketName}.s3.${process.env.AWS_REGION}.amazonaws.com/${key}`
        };
    } catch (error) {
        console.error("Error uploading to S3:", error);
        throw error;
    }
};

/**
 * Delete a file from S3
 * @param {string} fileName - The name of the file to delete
 */
const deleteFile = async (fileName) => {
    try {
        const command = new DeleteObjectCommand({
            Bucket: bucketName,
            Key: fileName,
        });
        await s3Client.send(command);
    } catch (error) {
        console.error("Error deleting from S3:", error);
        throw error;
    }
};

/**
 * Generate a signed URL for a file in S3 (valid for 1 hour by default)
 * @param {string} key - The S3 Key of the file
 * @param {number} expiresIn - Expiration time in seconds
 * @returns {Promise<string>} - The signed URL
 */
const getSignedFileUrl = async (key, expiresIn = 3600) => {
    try {
        const command = new GetObjectCommand({
            Bucket: bucketName,
            Key: key,
        });
        return await getSignedUrl(s3Client, command, { expiresIn });
    } catch (error) {
        console.error("Error generating signed URL:", error);
        throw error;
    }
};

/**
 * Get a readable stream for a file from S3
 * @param {string} key - The S3 Key of the file
 */
const getFileStream = async (key) => {
    try {
        const command = new GetObjectCommand({
            Bucket: bucketName,
            Key: key
        });

        const response = await s3Client.send(command);
        return {
            Body: response.Body,
            ContentType: response.ContentType
        };
    } catch (error) {
        console.error('[S3Utils] Stream Fetch Failed:', error);
        throw error;
    }
};

/**
 * Specifically upload a JSON Snapshot (Immutable Record)
 */
const uploadJsonSnapshot = async (data, folder, fileName) => {
    const content = JSON.stringify(data, null, 2);
    return await uploadFile(content, `${fileName}.json`, 'application/json', folder);
};

module.exports = {
    uploadFile,
    deleteFile,
    getSignedFileUrl,
    getFileStream,
    uploadJsonSnapshot,
    s3Client,
};
