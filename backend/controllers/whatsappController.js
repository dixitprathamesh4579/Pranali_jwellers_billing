const pool = require("../config/db");

const {
    sendDueReminder
} = require("../services/whatsappService");


// Normalize and validate Indian mobile numbers.
const normalizeIndianMobile = (value) => {
    const digits = String(value || "").replace(/\D/g, "");

    const mobile =
        digits.length === 12 && digits.startsWith("91")
            ? digits.slice(2)
            : digits;

    if (!/^[6-9]\d{9}$/.test(mobile)) {
        return null;
    }

    return `91${mobile}`;
};


// SEND WHATSAPP PAYMENT REMINDER
const sendWhatsAppDueReminder = async (req, res) => {
    try {

        const {
            customerPhone,
            recipientPhone
        } = req.body;

        // Validate original customer number.
        const normalizedCustomerPhone =
            normalizeIndianMobile(customerPhone);

        if (!normalizedCustomerPhone) {
            return res.status(400).json({
                success: false,
                message: "Invalid customer mobile number."
            });
        }

        // Validate confirmed recipient number.
        const normalizedRecipientPhone =
            normalizeIndianMobile(recipientPhone);

        if (!normalizedRecipientPhone) {
            return res.status(400).json({
                success: false,
                message: "Invalid recipient mobile number."
            });
        }


        // Fetch customer's pending bills.
        const [bills] = await pool.execute(
            `
            SELECT
                id,
                bill_number,
                customer_name,
                customer_phone,
                grand_total,
                paid_amount,
                due_amount

            FROM sh_bills

            WHERE customer_phone = ?
            AND due_amount > 0

            ORDER BY bill_date ASC, id ASC
            `,
            [
                normalizedCustomerPhone.slice(2)
            ]
        );


        if (bills.length === 0) {
            return res.status(404).json({
                success: false,
                message: "या ग्राहकाची कोणतीही बाकी रक्कम नाही."
            });
        }


        // Calculate actual pending amounts from database.
        const totalPurchase = bills.reduce(
            (sum, bill) =>
                sum + Number(bill.grand_total || 0),
            0
        );

        const totalPaid = bills.reduce(
            (sum, bill) =>
                sum + Number(bill.paid_amount || 0),
            0
        );

        const totalDue = bills.reduce(
            (sum, bill) =>
                sum + Number(bill.due_amount || 0),
            0
        );


        if (
            !Number.isFinite(totalDue) ||
            totalDue <= 0
        ) {
            return res.status(400).json({
                success: false,
                message: "Invalid pending balance."
            });
        }


        // Use the customer's actual name from the database.
        const customerName = bills[0].customer_name;

        // Collect pending bill numbers.
        const billNumbers = bills
            .map(bill => bill.bill_number)
            .join(", ");


        // Send WhatsApp message through Meta.
        const result = await sendDueReminder({

            recipientPhone: normalizedRecipientPhone,

            customerName,

            billNumbers,

            totalPurchase,

            totalPaid,

            totalDue

        });


        return res.status(200).json({
            success: true,

            message: "WhatsApp reminder submitted successfully.",

            messageId: result.messageId,

            totalDue
        });


    } catch (error) {

        console.error(
            "WhatsApp Due Reminder Error:",
            error.message
        );

        return res.status(500).json({
            success: false,
            message: error.message ||
                "Failed to send WhatsApp reminder."
        });
    }
};


module.exports = {
    sendWhatsAppDueReminder
};