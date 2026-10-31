require("dotenv").config();

async function sendOtpEmail(email, otp) {
    try {
        const response = await fetch(process.env.GOOGLE_SCRIPT_URL, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                secret: process.env.GOOGLE_SCRIPT_SECRET,
                email,
                otp
            })
        });

        const responseText = await response.text();

        console.log("Google Apps Script Status:", response.status);
        console.log(
            "Google Apps Script Content-Type:",
            response.headers.get("content-type")
        );
        console.log(
            "Google Apps Script Response:",
            responseText.substring(0, 1000)
        );

        let result;

        try {
            result = JSON.parse(responseText);
        } catch {
            throw new Error(
                "Google Apps Script returned non-JSON response. Check Render logs."
            );
        }

        if (!response.ok || !result.success) {
            throw new Error(result.message || "OTP delivery failed");
        }

        console.log("OTP email sent successfully");

        return result;

    } catch (error) {
        console.error("OTP Email Error:", error.message);
        throw error;
    }
}

module.exports = { sendOtpEmail };