const express = require("express");
const cors = require("cors");
const crypto = require("crypto");
require("dotenv").config();
const whatsappRoutes = require("./routes/whatsappRoutes");
const jwt = require("jsonwebtoken");
if (!process.env.JWT_SECRET) {
    console.error("FATAL ERROR: JWT_SECRET is not configured.");
    process.exit(1);
}

const pool = require("./config/db");
const { sendOtpEmail } = require("./services/emailService");

const shBillRoutes = require("./routes/shBillRoutes");
const giRoutes = require("./routes/giRoutes");
const dailyAccountsRoutes = require("./routes/dailyAccountsRoutes");

const app = express();

// ======================================
// 1. CORS CONFIGURATION
// ======================================

const allowedOrigins = [
    "http://localhost:5173",
    "https://pranali-jwellers-billing.dixitprathamesh4579.workers.dev"
];
app.use(cors({
    origin: function (origin, callback) {
        if (!origin || allowedOrigins.includes(origin)) {
            return callback(null, true);
        }

        return callback(new Error("Not allowed by CORS"));
    },
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"]
}));

// ======================================
// 2. BODY PARSING
// ======================================

app.use(express.json({
    verify: (req, res, buf) => {
        // Preserve the original request body for Meta signature verification.
        req.rawBody = Buffer.from(buf);
    }
}));

app.use(express.urlencoded({ extended: true }));

// ======================================
// 3. REQUEST LOGGING
// ======================================

if (process.env.NODE_ENV !== "production") {
    app.use((req, res, next) => {
        console.log(`${req.method} ${req.url}`);
        next();
    });
}

// ======================================
// 4. API ROUTES
// ======================================
app.use("/api/whatsapp", whatsappRoutes);
app.use("/api/daily-accounts", dailyAccountsRoutes);
app.use("/api/sh-bills", shBillRoutes);
app.use("/api/gi", giRoutes);

// Temporary debugging middleware


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

        // Generate JWT token valid for 24 hours.
        const token = jwt.sign(
            {
                userId: users[0].id,
                email: email
            },
            process.env.JWT_SECRET,
            {
                expiresIn: "24h"
            }
        );

        return res.status(200).json({
            message: "OTP verified successfully.",
            authenticated: true,
            token: token,
            expiresIn: 86400,
            user: {
                id: users[0].id,
                email: email
            }
        });

    } catch (error) {
        console.error("Verify OTP error:", error.message);

        return res.status(500).json({
            message: "An internal server error occurred."
        });
    }
});

// Check existing login session (JWT verification)
app.get("/api/auth/me", async (req, res) => {
    try {
        const authHeader = req.headers.authorization;

        if (!authHeader || !authHeader.startsWith("Bearer ")) {
            return res.status(401).json({
                authenticated: false,
                message: "No token provided"
            });
        }

        const token = authHeader.split(" ")[1];

        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        const [users] = await pool.execute(
            `SELECT id, email
             FROM authorized_users
             WHERE id = ? AND is_active = TRUE
             LIMIT 1`,
            [decoded.userId]
        );

        if (users.length === 0) {
            return res.status(401).json({
                authenticated: false,
                message: "User is not authorized"
            });
        }

        return res.status(200).json({
            authenticated: true,
            user: users[0]
        });

    } catch (error) {
        return res.status(401).json({
            authenticated: false,
            message: "Session expired or invalid"
        });
    }
});


// ======================================
// WHATSAPP WEBHOOK
// ======================================

// Meta webhook verification (GET)
app.get("/api/whatsapp/webhook", (req, res) => {
    const mode = req.query["hub.mode"];
    const token = req.query["hub.verify_token"];
    const challenge = req.query["hub.challenge"];

    const verifyToken = process.env.WHATSAPP_VERIFY_TOKEN;

    if (!verifyToken) {
        console.error("WHATSAPP_VERIFY_TOKEN is not configured.");
        return res.sendStatus(500);
    }

    if (mode === "subscribe" && token === verifyToken) {
        console.log("WhatsApp webhook verified successfully.");
        return res.status(200).send(challenge);
    }

    console.warn("WhatsApp webhook verification failed.");
    return res.sendStatus(403);
});


// Meta webhook events (POST)
app.post("/api/whatsapp/webhook", (req, res) => {
    try {
        const appSecret = process.env.WHATSAPP_APP_SECRET;

        if (!appSecret) {
            console.error("WHATSAPP_APP_SECRET is not configured.");
            return res.sendStatus(500);
        }

        const signature = req.headers["x-hub-signature-256"];

        if (!signature || !req.rawBody) {
            return res.sendStatus(401);
        }

        const expectedSignature =
            "sha256=" +
            crypto
                .createHmac("sha256", appSecret)
                .update(req.rawBody)
                .digest("hex");

        const receivedBuffer = Buffer.from(signature);
        const expectedBuffer = Buffer.from(expectedSignature);

        if (
            receivedBuffer.length !== expectedBuffer.length ||
            !crypto.timingSafeEqual(receivedBuffer, expectedBuffer)
        ) {
            console.warn("Invalid WhatsApp webhook signature.");
            return res.sendStatus(401);
        }

        // Process WhatsApp webhook events.
        const body = req.body;

        if (body.object === "whatsapp_business_account") {
            for (const entry of body.entry || []) {
                for (const change of entry.changes || []) {
                    const value = change.value || {};

                    // Incoming messages
                    for (const message of value.messages || []) {
                        console.log("WhatsApp incoming message:", {
                            from: message.from,
                            messageId: message.id,
                            type: message.type
                        });
                    }

                    // Message delivery/read/failure statuses
                    for (const status of value.statuses || []) {
                        console.log("WhatsApp message status:", {
                            messageId: status.id,
                            status: status.status,
                            recipient: status.recipient_id,
                            timestamp: status.timestamp
                        });
                    }
                }
            }
        }

        return res.sendStatus(200);

    } catch (error) {
        console.error("WhatsApp webhook error:", error.message);
        return res.sendStatus(500);
    }
});
const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
    console.log(`Backend running at http://localhost:${PORT}`);
});
app.get("/api/health", (req, res) => {
    return res.status(200).json({
        success: true,
        message: "Backend server is running",
        timestamp: new Date().toISOString()
    });
});