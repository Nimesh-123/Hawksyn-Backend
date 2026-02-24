const multer = require('multer');
const fs = require('fs');

const storage = multer.diskStorage({
    filename: (req, file, callback) => {
        const filename = Date.now() + Math.floor(Math.random() * 100) + file.originalname;
        callback(null, filename);
    },
    destination: (req, file, callback) => {
        if (!fs.existsSync('uploads')) {
            fs.mkdirSync('uploads');
        }
        callback(null, 'uploads');
    }
});

module.exports = multer({ storage });
