const cors = require("cors");
const express = require("express");
const cors = require("cors");
const crypto = require("crypto");
require("dotenv").config();

const pool = require("./config/db");
const { sendOtpEmail } = require("./services/emailService");
const shBillRoutes = require("./routes/shBillRoutes");
const giRoutes = require("./routes/giRoutes");
const app = express();
app.use(cors({
    origin: [
        "http://localhost:5173",
        "https://pranali-jwellers-billing.dixitprathamesh4579.workers.dev"
    ],
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"]
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use("/api/sh-bills", shBillRoutes);
app.use("/api/gi", giRoutes);

// Temporary debugging middleware
app.use((req, res, next) => {
    console.log("Method:", req.method);
    console.log("URL:", req.url);
    console.log("Content-Type:", req.headers["content-type"]);
    console.log("Request Body:", req.body);

    next();
});

// Temporary OTP storage for local development only.
const otpStore = new Map();

// Generate a cryptographically random six-digit OTP.
function generateOTP() {
    return crypto.randomInt(100000, 1000000).toString();
}

// Send OTP
app.post("/api/auth/send-otp", async (req, res) => {
    try {
        const email = String(req.body.email || "")
            .trim()
            .toLowerCase();

        if (!email || email.length > 255) {
            return res.status(400).json({
                message: "Please provide a valid email address."
            });
        }

        // Check whether this email is authorized.
        const [users] = await pool.execute(
            `SELECT id
             FROM authorized_users
             WHERE email = ? AND is_active = TRUE
             LIMIT 1`,
            [email]
        );

        if (users.length === 0) {
            return res.status(403).json({
                message: "This email is not authorized."
            });
        }

        const otp = generateOTP();

        // Store OTP and its expiration time.
        otpStore.set(email, {
            otp,
            expiresAt: Date.now() + 5 * 60 * 1000,
            attempts: 0
        });

        try {
            await sendOtpEmail(email, otp);
        } catch (emailError) {
            otpStore.delete(email);
            console.error("Email delivery failed:", emailError.message);

            return res.status(502).json({
                message: "Unable to send OTP. Please try again later."
            });
        }

        return res.status(200).json({
            message: "OTP sent successfully."
        });

    } catch (error) {
        console.error("Send OTP error:", error.message);

        return res.status(500).json({
            message: "An internal server error occurred."
        });
    }
});

// Verify OTP
app.post("/api/auth/verify-otp", async (req, res) => {
    try {
        const email = String(req.body.email || "")
            .trim()
            .toLowerCase();

        const otp = String(req.body.otp || "");

        if (!email || !/^\d{6}$/.test(otp)) {
            return res.status(400).json({
                message: "Please enter your email and six-digit OTP."
            });
        }

        const record = otpStore.get(email);

        if (!record) {
            return res.status(400).json({
                message: "OTP not found. Please request a new OTP."
            });
        }

        if (Date.now() > record.expiresAt) {
            otpStore.delete(email);

            return res.status(400).json({
                message: "OTP has expired. Please request a new OTP."
            });
        }

        if (record.attempts >= 5) {
            otpStore.delete(email);

            return res.status(429).json({
                message: "Too many incorrect attempts. Request a new OTP."
            });
        }

        if (record.otp !== otp) {
            record.attempts += 1;

            return res.status(400).json({
                message: "Incorrect OTP."
            });
        }

        // Recheck authorization before accepting the login.
        const [users] = await pool.execute(
            `SELECT id
             FROM authorized_users
             WHERE email = ? AND is_active = TRUE
             LIMIT 1`,
            [email]
        );

        if (users.length === 0) {
            otpStore.delete(email);

            return res.status(403).json({
                message: "This email is not authorized."
            });
        }

        // OTP must be single-use.
        otpStore.delete(email);

        // Authentication is verified, but session creation
        // will be implemented in the next stage.
        return res.status(200).json({
            message: "OTP verified successfully.",
            authenticated: true,
            user: {
                id: users[0].id,
                email
            }
        });

    } catch (error) {
        console.error("Verify OTP error:", error.message);

        return res.status(500).json({
            message: "An internal server error occurred."
        });
    }
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
    console.log(`Backend running at http://localhost:${PORT}`);
});
