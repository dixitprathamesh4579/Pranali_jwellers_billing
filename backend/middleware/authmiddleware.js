const jwt = require("jsonwebtoken");
const pool = require("../config/db");

const authenticateToken = async (req, res, next) => {
    console.log("================================");
    console.log("AUTHENTICATION STARTED");
    console.log("Request:", req.method, req.originalUrl);

    try {
        const authHeader = req.headers.authorization;

        if (!authHeader || !authHeader.startsWith("Bearer ")) {
            console.log("ERROR: Authorization header missing");

            return res.status(401).json({
                success: false,
                message: "Authentication required. Please login."
            });
        }

        const token = authHeader.split(" ")[1];

        console.log("STEP 1: Authorization header received");

        const decoded = jwt.verify(
            token,
            process.env.JWT_SECRET
        );

        console.log("STEP 2: JWT verified");
        console.log("User ID:", decoded.userId);

        console.log("STEP 3: Checking database connection...");

        const [users] = await pool.execute(
            `SELECT id, email
             FROM authorized_users
             WHERE id = ? AND is_active = TRUE
             LIMIT 1`,
            [decoded.userId]
        );

        console.log("STEP 4: Database query completed");

        if (users.length === 0) {
            console.log("ERROR: User not found or inactive");

            return res.status(401).json({
                success: false,
                message: "Your account is no longer authorized."
            });
        }

        req.user = {
            userId: users[0].id,
            email: users[0].email
        };

        console.log("STEP 5: Authentication successful");
        console.log("Passing request to controller...");

        return next();

    } catch (error) {
        console.error("AUTHENTICATION ERROR:", error);

        return res.status(401).json({
            success: false,
            message: "Session expired or invalid. Please login again."
        });
    }
};

module.exports = authenticateToken;