const pool = require("../config/db");
const {
    sendTextMessage
} = require("../services/whatsappService");

// ==========================================
// GET ALL WHATSAPP CONVERSATIONS
// ==========================================

const getConversations = async (req, res) => {
    try {
        const [conversations] = await pool.execute(
            `SELECT
                id,
                whatsapp_phone,
                customer_name,
                last_message,
                last_message_at,
                unread_count,
                created_at,
                updated_at
             FROM whatsapp_conversations
             ORDER BY
                last_message_at IS NULL ASC,
                last_message_at DESC,
                id DESC`
        );

        return res.status(200).json({
            success: true,
            conversations
        });

    } catch (error) {
        console.error("Get WhatsApp conversations error:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to fetch WhatsApp conversations."
        });
    }
};


// ==========================================
// GET MESSAGES OF A CONVERSATION
// ==========================================

const getConversationMessages = async (req, res) => {
    try {
        const conversationId = Number(req.params.id);

        if (
            !Number.isSafeInteger(conversationId) ||
            conversationId <= 0
        ) {
            return res.status(400).json({
                success: false,
                message: "Invalid conversation ID."
            });
        }

        const [conversations] = await pool.execute(
            `SELECT id, whatsapp_phone, customer_name
             FROM whatsapp_conversations
             WHERE id = ?
             LIMIT 1`,
            [conversationId]
        );

        if (conversations.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Conversation not found."
            });
        }

        // Fetch the latest 100 messages.
        const [messages] = await pool.execute(
            `SELECT
                id,
                conversation_id,
                whatsapp_message_id,
                direction,
                message_type,
                message_text,
                message_status,
                \`timestamp\`
             FROM whatsapp_messages
             WHERE conversation_id = ?
             ORDER BY \`timestamp\` DESC, id DESC
             LIMIT 100`,
            [conversationId]
        );

        // Return messages in chronological order.
        messages.reverse();

        return res.status(200).json({
            success: true,
            conversation: conversations[0],
            messages
        });

    } catch (error) {
        console.error("Get WhatsApp messages error:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to fetch WhatsApp messages."
        });
    }
};


// ==========================================
// MARK CONVERSATION AS READ
// ==========================================

const markConversationAsRead = async (req, res) => {
    try {
        const conversationId = Number(req.params.id);

        if (
            !Number.isSafeInteger(conversationId) ||
            conversationId <= 0
        ) {
            return res.status(400).json({
                success: false,
                message: "Invalid conversation ID."
            });
        }

        const [result] = await pool.execute(
            `UPDATE whatsapp_conversations
             SET unread_count = 0
             WHERE id = ?`,
            [conversationId]
        );

        if (result.affectedRows === 0) {
            const [existing] = await pool.execute(
                `SELECT id
                 FROM whatsapp_conversations
                 WHERE id = ?
                 LIMIT 1`,
                [conversationId]
            );

            if (existing.length === 0) {
                return res.status(404).json({
                    success: false,
                    message: "Conversation not found."
                });
            }
        }

        return res.status(200).json({
            success: true,
            message: "Conversation marked as read."
        });

    } catch (error) {
        console.error("Mark WhatsApp conversation read error:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to mark conversation as read."
        });
    }
};


// =====================================================
// SEND WHATSAPP CHAT MESSAGE
// =====================================================

const sendChatMessage = async (req, res) => {

    let connection;

    try {

        const conversationId = Number(req.params.id);

        const message = String(req.body.message || "").trim();

        if (
            !Number.isInteger(conversationId) ||
            conversationId <= 0
        ) {
            return res.status(400).json({
                success: false,
                message: "Invalid conversation ID."
            });
        }

        if (!message) {
            return res.status(400).json({
                success: false,
                message: "Message cannot be empty."
            });
        }

        if (message.length > 4096) {
            return res.status(400).json({
                success: false,
                message: "Message cannot exceed 4096 characters."
            });
        }

        // Find conversation.
        const [conversations] = await pool.execute(
            `SELECT id, whatsapp_phone
             FROM whatsapp_conversations
             WHERE id = ?
             LIMIT 1`,
            [conversationId]
        );

        if (conversations.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Conversation not found."
            });
        }

        const recipientPhone =
            String(conversations[0].whatsapp_phone).replace(/\D/g, "");

        if (!/^91[6-9]\d{9}$/.test(recipientPhone)) {
            return res.status(400).json({
                success: false,
                message: "Invalid WhatsApp recipient number."
            });
        }

        // Send message through Meta.
        const whatsappMessageId = await sendTextMessage({
            recipientPhone,
            message
        });

        // Save outgoing message.
        connection = await pool.getConnection();

        await connection.beginTransaction();

        const [insertResult] = await connection.execute(
            `INSERT INTO whatsapp_messages
            (
                conversation_id,
                whatsapp_message_id,
                direction,
                message_type,
                message_text,
                message_status,
                \`timestamp\`
            )
            VALUES (?, ?, 'OUTBOUND', 'TEXT', ?, 'SENT', NOW())`,
            [
                conversationId,
                whatsappMessageId,
                message
            ]
        );

        // Update conversation's latest message.
        await connection.execute(
            `UPDATE whatsapp_conversations
             SET last_message = ?,
                 last_message_at = NOW()
             WHERE id = ?`,
            [message, conversationId]
        );

        await connection.commit();

        return res.status(200).json({
            success: true,
            message: "WhatsApp message sent successfully.",
            whatsappMessageId,
            sentMessage: {
                id: insertResult.insertId,
                conversation_id: conversationId,
                whatsapp_message_id: whatsappMessageId,
                direction: "OUTBOUND",
                message_type: "TEXT",
                message_text: message,
                message_status: "SENT"
            }
        });

    } catch (error) {

        if (connection) {
            await connection.rollback();
        }

        console.error(
            "WhatsApp Chat Send Error:",
            error.message
        );

        return res.status(500).json({
            success: false,
            message: error.message ||
                "Failed to send WhatsApp message."
        });

    } finally {

        if (connection) {
            connection.release();
        }

    }
};

const createConversation = async (req, res) => {
    try {
        const { phone, customer_name } = req.body;

        if (!phone) {
            return res.status(400).json({
                message: "WhatsApp mobile number is required."
            });
        }

        // Normalize Indian mobile number.
        let normalizedPhone = String(phone).replace(/\D/g, "");

        if (normalizedPhone.length === 10) {
            normalizedPhone = "91" + normalizedPhone;
        }

        if (!/^91[6-9]\d{9}$/.test(normalizedPhone)) {
            return res.status(400).json({
                message: "Please enter a valid Indian WhatsApp mobile number."
            });
        }

        const cleanName = customer_name
            ? String(customer_name).trim().slice(0, 150)
            : null;

        const [result] = await pool.query(
            `
            INSERT INTO whatsapp_conversations
                (whatsapp_phone, customer_name)
            VALUES (?, ?)
            ON DUPLICATE KEY UPDATE
                customer_name = CASE
                    WHEN VALUES(customer_name) IS NOT NULL
                         AND VALUES(customer_name) != ''
                    THEN VALUES(customer_name)
                    ELSE customer_name
                END
            `,
            [normalizedPhone, cleanName]
        );

        const [rows] = await pool.query(
            `
            SELECT *
            FROM whatsapp_conversations
            WHERE whatsapp_phone = ?
            LIMIT 1
            `,
            [normalizedPhone]
        );

        return res.json({
            success: true,
            conversation: rows[0]
        });

    } catch (error) {
        console.error("Create WhatsApp conversation error:", error);

        return res.status(500).json({
            message: "Failed to create WhatsApp conversation."
        });
    }
};

module.exports = {
    getConversations,
    getConversationMessages,
    markConversationAsRead,
    sendChatMessage,
    createConversation
};