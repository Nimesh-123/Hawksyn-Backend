const { uploadFile } = require('../../utils/s3');
const RESPONSE = require('../../utils/response');

exports.testUpload = async (req, res) => {
    try {
        if (!req.file) {
            return RESPONSE.error(res, 400, 1002, "No file uploaded");
        }

        const fileName = `test/${Date.now()}-${req.file.originalname}`;
        const fileUrl = await uploadFile(req.file.buffer, fileName, req.file.mimetype);

        return RESPONSE.success(res, 200, 1001, {
            message: "File uploaded successfully to S3",
            url: fileUrl,
            key: fileName
        });
    } catch (err) {
        return RESPONSE.error(res, 500, 9999, err.message);
    }
};
