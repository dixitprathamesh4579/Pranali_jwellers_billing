require("dotenv").config();

async function sendOtpEmail(email, otp) {
    try {

        // Send OTP request to Google Apps Script
        const response = await fetch(process.env.GOOGLE_SCRIPT_URL, {
            method: "POST",

            headers: {
                "Content-Type": "application/json"
            },

            body: JSON.stringify({
                secret: process.env.GOOGLE_SCRIPT_SECRET,
                email: email,
                otp: otp
            })
        });

        // Read Google Apps Script response
        const responseText = await response.text();

        let result;

        try {
            result = JSON.parse(responseText);
        } catch (error) {
            throw new Error(
                "Invalid response received from Google Apps Script"
            );
        }

        // Check email delivery status
        if (!response.ok || !result.success) {
            throw new Error(
                result.message || "Failed to send OTP email"
            );
        }

        console.log("OTP email sent successfully to:", email);

        return result;

    } catch (error) {

        console.error("OTP Email Error:", error.message);

        throw error;
    }
}

module.exports = { sendOtpEmail };