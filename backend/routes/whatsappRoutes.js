const express = require("express");
const multer = require("multer");

const router = express.Router();

const authenticateToken = require("../middleware/authmiddleware");

// Chat controllers
const {
    getConversations,
    getConversationMessages,
    markConversationAsRead,
    sendChatMessage,
    createConversation
} = require("../controllers/whatsappChatController");

// Existing WhatsApp controllers
const {
    sendWhatsAppDueReminder,
    sendWhatsAppBillPdf
} = require("../controllers/whatsappController");


// ==========================================
// PDF UPLOAD CONFIGURATION
// ==========================================

const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: 16 * 1024 * 1024
    }
});


// ==========================================
// EXISTING WHATSAPP FEATURES
// ==========================================

router.post(
    "/send-due-reminder",
    authenticateToken,
    sendWhatsAppDueReminder
);

router.post(
    "/send-bill-pdf",
    authenticateToken,
    upload.single("pdf"),
    sendWhatsAppBillPdf
);


// ==========================================
// WHATSAPP CHAT FEATURES
// ==========================================

// Create or open conversation
router.post(
    "/conversations",
    authenticateToken,
    createConversation
);

// Get all conversations
router.get(
    "/conversations",
    authenticateToken,
    getConversations
);

// Get conversation messages
router.get(
    "/conversations/:id/messages",
    authenticateToken,
    getConversationMessages
);

// Mark conversation as read
router.patch(
    "/conversations/:id/read",
    authenticateToken,
    markConversationAsRead
);

// Send chat message
router.post(
    "/conversations/:id/messages",
    authenticateToken,
    sendChatMessage
);


module.exports = router;