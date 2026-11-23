const QRCode = require("qrcode");


// =====================================================
// COMMON WHATSAPP HELPERS
// =====================================================


// Format amount in Indian currency format.
const formatMoney = (amount) => {

    return `₹${Number(amount || 0).toLocaleString("en-IN", {
        maximumFractionDigits: 2
    })}`;

};


// Validate WhatsApp API configuration.
const getWhatsAppConfig = () => {

    const token = process.env.WHATSAPP_ACCESS_TOKEN;
    const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
    const apiVersion = process.env.WHATSAPP_API_VERSION;

    if (!token || !phoneNumberId || !apiVersion) {
        throw new Error("WhatsApp API configuration is incomplete.");
    }

    return {
        token,
        phoneNumberId,
        apiVersion
    };

};


// =====================================================
// DUE REMINDER - DYNAMIC UPI QR CODE
// =====================================================


// Generate UPI QR code for the exact outstanding amount.
const generateUPIQR = async (amount, billNumbers) => {

    const upiId = process.env.REMINDER_UPI_ID;
    const payeeName = process.env.REMINDER_PAYEE_NAME;

    if (!upiId || !payeeName) {
        throw new Error("UPI payment configuration is incomplete.");
    }

    const dueAmount = Number(amount);

    if (!Number.isFinite(dueAmount) || dueAmount <= 0) {
        throw new Error("Invalid outstanding amount for UPI QR code.");
    }

    const upiParams = new URLSearchParams({
        pa: upiId,
        pn: payeeName,
        am: dueAmount.toFixed(2),
        cu: "INR",
        tn: `Pranali Jewellers Due ${billNumbers}`
    });

    const upiString = `upi://pay?${upiParams.toString()}`;

    const qrBuffer = await QRCode.toBuffer(upiString, {
        type: "png",
        width: 600,
        margin: 2,
        errorCorrectionLevel: "H"
    });

    return qrBuffer;

};


// Upload image media to Meta WhatsApp servers.
const uploadWhatsAppMedia = async (mediaBuffer) => {

    const {
        token,
        phoneNumberId,
        apiVersion
    } = getWhatsAppConfig();

    const formData = new FormData();

    formData.append("messaging_product", "whatsapp");

    formData.append(
        "file",
        new Blob([mediaBuffer], {
            type: "image/png"
        }),
        "Pranali-Jewellers-UPI-QR.png"
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

        console.error("WhatsApp QR Upload Error:", result);

        throw new Error(
            result.error?.message ||
            "Unable to upload UPI QR code to WhatsApp."
        );

    }

    return result.id;

};


// Send due reminder WhatsApp template.
const sendWhatsAppTemplate = async ({
    recipientPhone,
    mediaId,
    customerName,
    billNumbers,
    totalPurchase,
    totalPaid,
    totalDue
}) => {

    const {
        token,
        phoneNumberId,
        apiVersion
    } = getWhatsAppConfig();

    const templateName =
        process.env.WHATSAPP_TEMPLATE_NAME;

    const languageCode =
        process.env.WHATSAPP_TEMPLATE_LANGUAGE || "mr";

    if (!templateName) {
        throw new Error("Due reminder WhatsApp template is not configured.");
    }

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

                // Dynamic UPI QR image header
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

                // Reminder body parameters
                {
                    type: "body",

                    parameters: [

                        {
                            type: "text",
                            text: String(customerName)
                        },

                        {
                            type: "text",
                            text: String(billNumbers)
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

        console.error("WhatsApp Due Reminder Error:", result);

        throw new Error(
            result.error?.message ||
            "Unable to send WhatsApp due reminder."
        );

    }

    return result.messages[0].id;

};


// Main function for sending due reminder.
const sendDueReminder = async ({
    recipientPhone,
    customerName,
    billNumbers,
    totalPurchase,
    totalPaid,
    totalDue
}) => {

    if (!recipientPhone) {
        throw new Error("Recipient WhatsApp number is required.");
    }

    const dueAmount = Number(totalDue);

    if (!Number.isFinite(dueAmount) || dueAmount <= 0) {
        throw new Error("Invalid outstanding amount.");
    }

    // 1. Generate UPI QR for exact outstanding amount.
    const qrBuffer = await generateUPIQR(
        dueAmount,
        billNumbers
    );

    // 2. Upload QR image to Meta.
    const mediaId = await uploadWhatsAppMedia(qrBuffer);

    // 3. Send Marathi due reminder template.
    const messageId = await sendWhatsAppTemplate({

        recipientPhone,

        mediaId,

        customerName,

        billNumbers,

        totalPurchase,

        totalPaid,

        totalDue: dueAmount

    });

    return {
        messageId,
        mediaId
    };

};


// =====================================================
// WHATSAPP BILL PDF FUNCTIONS
// =====================================================


// Upload PDF document to Meta WhatsApp servers.
const uploadWhatsAppDocument = async (pdfBuffer, filename) => {

    const {
        token,
        phoneNumberId,
        apiVersion
    } = getWhatsAppConfig();

    const formData = new FormData();

    formData.append("messaging_product", "whatsapp");

    formData.append(
        "file",
        new Blob([pdfBuffer], {
            type: "application/pdf"
        }),
        filename
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

        console.error("WhatsApp PDF Upload Error:", result);

        throw new Error(
            result.error?.message ||
            "Unable to upload bill PDF to WhatsApp."
        );

    }

    return result.id;

};


// Send bill PDF using approved WhatsApp document template.
const sendWhatsAppBillTemplate = async ({
    recipientPhone,
    mediaId,
    filename,
    customerName,
    billNumber,
    billDate,
    grandTotal,
    paidAmount,
    dueAmount
}) => {
    const {
        token,
        phoneNumberId,
        apiVersion
    } = getWhatsAppConfig();

    const templateName =
        process.env.WHATSAPP_BILL_TEMPLATE_NAME;

    const languageCode =
        process.env.WHATSAPP_BILL_TEMPLATE_LANGUAGE || "mr";

    if (!templateName) {
        throw new Error("Bill WhatsApp template is not configured.");
    }

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

                // Document header
                {
                    type: "header",

                    parameters: [
                        {
                            type: "document",

                            document: {
                                id: mediaId,
                                filename
                            }
                        }
                    ]
                },

                // Bill details
                {
                    type: "body",
                    parameters: [
                        {
                            type: "text",
                            text: customerName
                        },
                        {
                            type: "text",
                            text: billNumber
                        },
                        {
                            type: "text",
                            text: billDate
                        },
                        {
                            type: "text",
                            text: formatMoney(grandTotal)
                        },
                        {
                            type: "text",
                            text: formatMoney(paidAmount)
                        },
                        {
                            type: "text",
                            text: formatMoney(dueAmount)
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

        console.error("WhatsApp Bill Message Error:", result);

        throw new Error(
            result.error?.message ||
            "Unable to send bill PDF through WhatsApp."
        );

    }

    return result.messages[0].id;

};


// Main function for sending bill PDF.
const sendBillPdf = async ({
    recipientPhone,
    pdfBuffer,
    customerName,
    billNumber,
    billDate,
    grandTotal,
    paidAmount,
    dueAmount
}) => {

    if (!pdfBuffer || !Buffer.isBuffer(pdfBuffer)) {
        throw new Error("Valid bill PDF buffer is required.");
    }

    const filename = `Pranali-Jewellers-${billNumber}.pdf`;

    // 1. Upload PDF to Meta.
    const mediaId = await uploadWhatsAppDocument(
        pdfBuffer,
        filename
    );

    // 2. Send document template.
    const messageId = await sendWhatsAppBillTemplate({

    recipientPhone,

    mediaId,

    filename,

    customerName,

    billNumber,

    billDate,

    grandTotal,

    paidAmount,

    dueAmount

});

    return {
        messageId,
        mediaId
    };

};


// =====================================================
// EXPORTS
// =====================================================

module.exports = {
    sendDueReminder,
    sendBillPdf
};