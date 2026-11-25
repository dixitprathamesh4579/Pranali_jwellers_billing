const pool = require("../config/db");

// Extract readable text from different WhatsApp message types.
const extractMessageText = (message) => {
    switch (message.type) {
        case "text":
            return message.text?.body || "";

        case "image":
            return message.image?.caption || "[Image received]";

        case "document":
            return (
                message.document?.caption ||
                message.document?.filename ||
                "[Document received]"
            );

        case "video":
            return message.video?.caption || "[Video received]";

        case "audio":
            return "[Audio received]";

        case "sticker":
            return "[Sticker received]";

        case "location":
            return "[Location received]";

        case "contacts":
            return "[Contact received]";

        case "button":
            return message.button?.text || "[Button reply]";

        case "interactive":
            return (
                message.interactive?.button_reply?.title ||
                message.interactive?.list_reply?.title ||
                "[Interactive reply]"
            );

        default:
            return `[${message.type || "Unknown"} message]`;
    }
};

// Convert Meta Unix timestamp into JavaScript Date.
const convertTimestamp = (timestamp) => {
    const date = new Date(Number(timestamp) * 1000);

    return Number.isNaN(date.getTime()) ? new Date() : date;
};

// Save incoming WhatsApp message.
const saveIncomingMessage = async (message, contacts = []) => {
    const whatsappPhone = String(message.from || "").replace(/\D/g, "");

    if (!whatsappPhone || !message.id) {
        console.warn("Invalid incoming WhatsApp message.");
        return;
    }

    const contact = contacts.find(
        (item) => item.wa_id === message.from
    );

    const customerName = contact?.profile?.name || null;
    const messageText = extractMessageText(message);
    const messageTimestamp = convertTimestamp(message.timestamp);

    const connection = await pool.getConnection();

    try {
        await connection.beginTransaction();

        // Create conversation if it does not exist.
        await connection.execute(
            `INSERT INTO whatsapp_conversations
                (whatsapp_phone, customer_name)
             VALUES (?, ?)
             ON DUPLICATE KEY UPDATE
                customer_name = COALESCE(customer_name, VALUES(customer_name))`,
            [whatsappPhone, customerName]
        );

        // Get conversation ID.
        const [conversations] = await connection.execute(
            `SELECT id
             FROM whatsapp_conversations
             WHERE whatsapp_phone = ?
             LIMIT 1`,
            [whatsappPhone]
        );

        if (!conversations.length) {
            throw new Error("WhatsApp conversation not found.");
        }

        const conversationId = conversations[0].id;

        // INSERT IGNORE prevents duplicate messages from webhook retries.
        const [insertResult] = await connection.execute(
            `INSERT IGNORE INTO whatsapp_messages
                (
                    conversation_id,
                    whatsapp_message_id,
                    direction,
                    message_type,
                    message_text,
                    message_status,
                    timestamp
                )
             VALUES (?, ?, 'INBOUND', ?, ?, 'RECEIVED', ?)`,
            [
                conversationId,
                message.id,
                message.type || "unknown",
                messageText,
                messageTimestamp
            ]
        );

        // Update conversation only when a new message was inserted.
        if (insertResult.affectedRows > 0) {
            await connection.execute(
                `UPDATE whatsapp_conversations
     SET
        last_message = CASE
            WHEN last_message_at IS NULL OR last_message_at <= ?
            THEN ?
            ELSE last_message
        END,
        last_message_at = CASE
            WHEN last_message_at IS NULL OR last_message_at <= ?
            THEN ?
            ELSE last_message_at
        END,
        unread_count = unread_count + 1
     WHERE id = ?`,
                [
                    messageTimestamp,
                    messageText,
                    messageTimestamp,
                    messageTimestamp,
                    conversationId
                ]
            );
        }

        await connection.commit();

        console.log("WhatsApp message saved:", message.id);

    } catch (error) {
        await connection.rollback();

        console.error("Save incoming WhatsApp message error:", error);

        throw error;

    } finally {
        connection.release();
    }
};

// Update delivery/read status of outgoing messages.
const updateMessageStatus = async (status) => {
    if (!status.id || !status.status) return;

    await pool.execute(
        `UPDATE whatsapp_messages
         SET message_status = ?
         WHERE whatsapp_message_id = ?`,
        [status.status.toUpperCase(), status.id]
    );

    console.log(
        `WhatsApp message ${status.id} status: ${status.status}`
    );
};

// Main webhook processor.
const processWhatsAppWebhook = async (body) => {
    if (body.object !== "whatsapp_business_account") {
        return;
    }

    for (const entry of body.entry || []) {
        for (const change of entry.changes || []) {
            const value = change.value || {};

            // Process incoming customer messages.
            for (const message of value.messages || []) {
                await saveIncomingMessage(
                    message,
                    value.contacts || []
                );
            }

            // Process message delivery/read statuses.
            for (const status of value.statuses || []) {
                await updateMessageStatus(status);
            }
        }
    }
};

module.exports = {
    processWhatsAppWebhook
};