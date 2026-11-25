const pool = require("../config/db");

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


module.exports = {
    getConversations,
    getConversationMessages,
    markConversationAsRead
};