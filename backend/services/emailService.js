
const nodemailer = require("nodemailer");
require("dotenv").config();

const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
        user: process.env.SMTP_EMAIL,
        pass: process.env.SMTP_APP_PASSWORD
    }
});

async function sendOtpEmail(email, otp) {
    await transporter.sendMail({
        from: `"Jewellery Billing System" <${process.env.SMTP_EMAIL}>`,
        to: email,
        subject: "Your Jewellery Billing Login OTP",
        text: `Your login OTP is ${otp}. It expires in 5 minutes. Do not share this code with anyone.`,
        html: `
            <div style="font-family: Arial, sans-serif; padding: 20px;">
                <h2>Jewellery Billing System</h2>
                <p>Use the following OTP to access your account:</p>
                <h1 style="letter-spacing: 8px;">${otp}</h1>
                <p>This OTP expires in 5 minutes.</p>
                <p>If you did not request this code, ignore this email.</p>
            </div>
        `
    });
}

module.exports = { sendOtpEmail };
