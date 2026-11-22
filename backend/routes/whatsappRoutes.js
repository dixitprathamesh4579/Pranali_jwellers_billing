const express = require("express");

const router = express.Router();

const authenticateToken = require("../middleware/authmiddleware");

const {
    sendWhatsAppDueReminder
} = require("../controllers/whatsappController");


// Protect all WhatsApp API routes.
router.use(authenticateToken);


// Send payment reminder.
router.post(
    "/send-due-reminder",
    sendWhatsAppDueReminder
);


module.exports = router;