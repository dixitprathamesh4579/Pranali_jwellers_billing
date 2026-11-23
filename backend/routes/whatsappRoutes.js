const express = require("express");
const multer = require("multer");

const router = express.Router();

const authenticateToken = require("../middleware/authmiddleware");

const {
    sendWhatsAppDueReminder,
    sendWhatsAppBillPdf
} = require("../controllers/whatsappController");


// PDF upload configuration
const upload = multer({
    storage: multer.memoryStorage(),

    limits: {
        fileSize: 16 * 1024 * 1024 // 16 MB
    }
});


// Existing due reminder route
router.post(
    "/send-due-reminder",
    authenticateToken,
    sendWhatsAppDueReminder
);


// New bill PDF WhatsApp route
router.post(
    "/send-bill-pdf",
    authenticateToken,
    upload.single("pdf"),
    sendWhatsAppBillPdf
);


module.exports = router;