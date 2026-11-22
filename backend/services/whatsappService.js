const QRCode = require("qrcode");

// Format currency for WhatsApp template parameters.
const formatMoney = (amount) => {
    return `₹${Number(amount).toFixed(2)}`;
};


// Generate UPI payment QR code.
const generateUPIQR = async (amount, billNumbers) => {
    const upiId = process.env.REMINDER_UPI_ID;
    const payeeName = process.env.REMINDER_PAYEE_NAME;

    if (!upiId || !payeeName) {
        throw new Error("UPI payment details are not configured.");
    }

    if (!Number.isFinite(amount) || amount <= 0) {
        throw new Error("Invalid UPI payment amount.");
    }

    const upiURL = new URL("upi://pay");

    upiURL.searchParams.set("pa", upiId);
    upiURL.searchParams.set("pn", payeeName);
    upiURL.searchParams.set("am", amount.toFixed(2));
    upiURL.searchParams.set("cu", "INR");
    upiURL.searchParams.set(
        "tn",
        `Pranali Jewellers Due ${billNumbers}`
    );

    const qrBuffer = await QRCode.toBuffer(
        upiURL.toString(),
        {
            type: "png",
            errorCorrectionLevel: "H",
            width: 700,
            margin: 2
        }
    );

    return qrBuffer;
};


// Upload QR image to Meta WhatsApp servers.
const uploadWhatsAppMedia = async (qrBuffer) => {
    const token = process.env.WHATSAPP_ACCESS_TOKEN;
    const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
    const apiVersion = process.env.WHATSAPP_API_VERSION;

    const formData = new FormData();

    formData.append("messaging_product", "whatsapp");

    formData.append(
        "file",
        new Blob([qrBuffer], {
            type: "image/png"
        }),
        "payment-qr.png"
    );

    const response = await fetch(
        `https://graph.facebook.com/${apiVersion}/${phoneNumberId}/media`,
        {
            method: "POST",
            headers: {
                Authorization: `Bearer ${token}`
            },
            body: formData
        }
    );

    const result = await response.json();

    if (!response.ok || !result.id) {
        console.error("WhatsApp Media Upload Error:", result);

        throw new Error(
            result.error?.message ||
            "Unable to upload payment QR code to WhatsApp."
        );
    }

    return result.id;
};


// Send approved WhatsApp template.
const sendWhatsAppTemplate = async ({
    recipientPhone,
    customerName,
    billNumbers,
    totalPurchase,
    totalPaid,
    totalDue,
    mediaId
}) => {
    const token = process.env.WHATSAPP_ACCESS_TOKEN;
    const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
    const apiVersion = process.env.WHATSAPP_API_VERSION;
    const templateName = process.env.WHATSAPP_TEMPLATE_NAME;
    const languageCode =
        process.env.WHATSAPP_TEMPLATE_LANGUAGE || "mr";

    const url =
        `https://graph.facebook.com/${apiVersion}/${phoneNumberId}/messages`;

    const payload = {
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to: recipientPhone,
        type: "template",

        template: {
            name: templateName,

            language: {
                code: languageCode
            },

            components: [
                {
                    type: "header",

                    parameters: [
                        {
                            type: "image",

                            image: {
                                id: mediaId
                            }
                        }
                    ]
                },

                {
                    type: "body",

                    parameters: [
                        {
                            type: "text",
                            text: customerName
                        },
                        {
                            type: "text",
                            text: billNumbers
                        },
                        {
                            type: "text",
                            text: formatMoney(totalPurchase)
                        },
                        {
                            type: "text",
                            text: formatMoney(totalPaid)
                        },
                        {
                            type: "text",
                            text: formatMoney(totalDue)
                        }
                    ]
                }
            ]
        }
    };

    const response = await fetch(url, {
        method: "POST",

        headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json"
        },

        body: JSON.stringify(payload)
    });

    const result = await response.json();

    if (!response.ok || !result.messages?.[0]?.id) {
        console.error("WhatsApp Message Error:", result);

        throw new Error(
            result.error?.message ||
            "Unable to send WhatsApp reminder."
        );
    }

    return result.messages[0].id;
};


// MAIN FUNCTION
const sendDueReminder = async ({
    recipientPhone,
    customerName,
    billNumbers,
    totalPurchase,
    totalPaid,
    totalDue
}) => {

    // 1. Generate QR with exact pending amount.
    const qrBuffer = await generateUPIQR(
        totalDue,
        billNumbers
    );

    // 2. Upload QR image.
    const mediaId = await uploadWhatsAppMedia(qrBuffer);

    // 3. Send WhatsApp template.
    const messageId = await sendWhatsAppTemplate({
        recipientPhone,
        customerName,
        billNumbers,
        totalPurchase,
        totalPaid,
        totalDue,
        mediaId
    });

    return {
        messageId,
        mediaId
    };
};


module.exports = {
    sendDueReminder
};