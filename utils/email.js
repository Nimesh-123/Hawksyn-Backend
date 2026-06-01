const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
    service: process.env.EMAIL_SERVICE || 'Gmail',
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    }
});

const sendEmail = async (options) => {
    const mailOptions = {
        from: `Hawksyn <${process.env.EMAIL_USER}>`,
        to: options.email,
        subject: options.subject,
        text: options.message,
        html: options.html
    };

    console.time(`[Email] Time taken to send to ${options.email}`);
    try {
        await transporter.sendMail(mailOptions);
    } finally {
        console.timeEnd(`[Email] Time taken to send to ${options.email}`);
    }
};

module.exports = sendEmail;
