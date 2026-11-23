const express = require("express");

const router = express.Router();

const authenticateToken = require("../middleware/authmiddleware");

const {
    sendWhatsAppDueReminder
} = require("../controllers/whatsappController");

// Protect only the reminder endpoint.
router.post(
    "/send-due-reminder",
    authenticateToken,
    sendWhatsAppDueReminder
);

module.exports = router;