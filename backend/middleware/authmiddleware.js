const jwt = require("jsonwebtoken");
const pool = require("../config/db");

const authenticateToken = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;

        if (!authHeader || !authHeader.startsWith("Bearer ")) {
            return res.status(401).json({
                success: false,
                message: "Authentication required. Please login."
            });
        }

        const token = authHeader.split(" ")[1];

        const decoded = jwt.verify(
            token,
            process.env.JWT_SECRET
        );

        // Verify that the user is still active
        const [users] = await pool.execute(
            `SELECT id, email
             FROM authorized_users
             WHERE id = ? AND is_active = TRUE
             LIMIT 1`,
            [decoded.userId]
        );

        if (users.length === 0) {
            return res.status(401).json({
                success: false,
                message: "Your account is no longer authorized."
            });
        }

        req.user = {
            userId: users[0].id,
            email: users[0].email
        };

        next();

    } catch (error) {
        console.error("Authentication error:", error.message);

        return res.status(401).json({
            success: false,
            message: "Session expired or invalid. Please login again."
        });
    }
};

module.exports = authenticateToken;