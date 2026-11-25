const express = require("express");
const multer = require("multer");

const router = express.Router();

const {
    getConversations,
    getConversationMessages,
    markConversationAsRead,
    sendChatMessage,
    createConversation
} = require("../controllers/whatsappChatController");

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

// ==========================================
// WHATSAPP CUSTOMER CHAT ROUTES
// ==========================================

router.get(
    "/conversations",
    authenticateToken,
    getConversations
);

router.get(
    "/conversations/:id/messages",
    authenticateToken,
    getConversationMessages
);

router.patch(
    "/conversations/:id/read",
    authenticateToken,
    markConversationAsRead
);
router.post(
    "/conversations/:id/messages",
    authenticateToken,
    sendChatMessage
);
router.post("/conversations", authenticateToken, createConversation);


module.exports = router;