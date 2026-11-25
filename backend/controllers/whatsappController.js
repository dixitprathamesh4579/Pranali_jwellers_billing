const pool = require("../config/db");
const {
    sendDueReminder,
    sendBillPdf
} = require("../services/whatsappService");


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

// Format bill date as DD/MM/YYYY.
const formatBillDate = (value) => {
    if (!value) return "";

    const date = String(value).slice(0, 10);
    const parts = date.split("-");

    if (parts.length !== 3) return date;

    return `${parts[2]}/${parts[1]}/${parts[0]}`;
};


// Extract item names from bill JSON.
// Extract item names from bill JSON.
const extractItemNames = (items) => {
    try {
        const parsedItems =
            typeof items === "string"
                ? JSON.parse(items)
                : items;

        if (!Array.isArray(parsedItems)) {
            return "";
        }

        return parsedItems
            .map(item => item.name)
            .filter(Boolean)
            .join(", ");

    } catch (error) {
        console.error("Item JSON parsing error:", error.message);
        return "";
    }
};
const sendWhatsAppDueReminder = async (req, res) => {
    try {
        const {
            customerPhone,
            recipientPhone
        } = req.body;

        const normalizedCustomerPhone =
            normalizeIndianMobile(customerPhone);

        const normalizedRecipientPhone =
            normalizeIndianMobile(recipientPhone);
        console.log("Customer Phone from frontend:", customerPhone);
        console.log("Recipient Phone from frontend:", recipientPhone);

        console.log(
            "Normalized Customer Phone:",
            normalizeIndianMobile(customerPhone)
        );

        console.log(
            "Normalized Recipient Phone:",
            normalizeIndianMobile(recipientPhone)
        );



        if (!normalizedRecipientPhone) {
            return res.status(400).json({
                success: false,
                message: "Invalid recipient mobile number."
            });
        }

        // Fetch ALL customer bills.
        const [bills] = await pool.execute(
            `SELECT
        id,
        bill_number,
        bill_date,
        customer_name,
        items,
        grand_total,
        paid_amount,
        due_amount
     FROM sh_bills
     WHERE customer_phone = ?
     ORDER BY bill_date ASC, id ASC`,
            [customerPhone]
        );
        if (bills.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Customer bills not found."
            });
        }

        // Calculate using integer paise to avoid floating-point errors.
        const toPaise = value =>
            Math.round(Number(value || 0) * 100);

        const totalPurchasePaise = bills.reduce(
            (sum, bill) => sum + toPaise(bill.grand_total),
            0
        );

        const totalPaidPaise = bills.reduce(
            (sum, bill) => sum + toPaise(bill.paid_amount),
            0
        );

        const pendingBills = bills.filter(
            bill => toPaise(bill.due_amount) > 0
        );

        const totalDuePaise = pendingBills.reduce(
            (sum, bill) => sum + toPaise(bill.due_amount),
            0
        );

        if (totalDuePaise <= 0) {
            return res.status(400).json({
                success: false,
                message: "No pending dues for this customer."
            });
        }

        const totalPurchase = totalPurchasePaise / 100;
        const totalPaid = totalPaidPaise / 100;
        const totalDue = totalDuePaise / 100;

        const customerName = bills[0].customer_name;

        // Extract details from all pending bills.
        const billNumbers = pendingBills
            .map(bill => bill.bill_number)
            .join(", ");

        const billDates = pendingBills
            .map(bill => formatBillDate(bill.bill_date))
            .join(", ");

        const itemNames = pendingBills
            .map(bill => extractItemNames(bill.items))
            .filter(Boolean)
            .join(", ");
        // Send reminder through WhatsApp Cloud API.
        const result = await sendDueReminder({
            recipientPhone: normalizedRecipientPhone,
            customerName,
            billNumbers,
            billDates,
            itemNames,
            totalPurchase,
            totalPaid,
            totalDue
        });
        return res.status(200).json({
            success: true,
            message: "WhatsApp reminder accepted by Meta.",
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
const sendWhatsAppBillPdf = async (req, res) => {

    try {

        const {
            billId,
            recipientPhone
        } = req.body;


        // Validate bill ID.
        if (!billId || !Number.isInteger(Number(billId)) || Number(billId) <= 0) {

            return res.status(400).json({
                success: false,
                message: "Invalid bill ID."
            });

        }


        // Validate recipient mobile.
        const normalizedRecipientPhone =
            normalizeIndianMobile(recipientPhone);

        if (!normalizedRecipientPhone) {

            return res.status(400).json({
                success: false,
                message: "Invalid recipient mobile number."
            });

        }


        // Validate uploaded PDF.
        if (!req.file) {

            return res.status(400).json({
                success: false,
                message: "Bill PDF is required."
            });

        }


        if (req.file.mimetype !== "application/pdf") {

            return res.status(400).json({
                success: false,
                message: "Only PDF files are allowed."
            });

        }


        // Verify actual PDF file signature.
        if (
            req.file.buffer.length < 5 ||
            req.file.buffer.subarray(0, 5).toString() !== "%PDF-"
        ) {

            return res.status(400).json({
                success: false,
                message: "Invalid PDF file."
            });

        }


        // Fetch actual bill details from database.
        const [bills] = await pool.execute(
            `SELECT
    id,
    bill_number,
    bill_date,
    customer_name,
    grand_total,
    paid_amount,
    due_amount
 FROM sh_bills
 WHERE id = ?
 LIMIT 1`,
            [Number(billId)]
        );


        if (bills.length === 0) {

            return res.status(404).json({
                success: false,
                message: "Bill not found."
            });

        }


        const bill = bills[0];


        // Format date as DD/MM/YYYY.
        const billDate = (() => {

            if (typeof bill.bill_date === "string") {

                const datePart = bill.bill_date.slice(0, 10);
                const parts = datePart.split("-");

                if (parts.length === 3) {
                    return `${parts[2]}/${parts[1]}/${parts[0]}`;
                }

            }

            return new Date(bill.bill_date).toLocaleDateString("en-GB", {
                timeZone: "Asia/Kolkata"
            });

        })();


        // Send PDF through WhatsApp.
        const result = await sendBillPdf({

            recipientPhone: normalizedRecipientPhone,

            pdfBuffer: req.file.buffer,

            customerName: bill.customer_name,

            billNumber: bill.bill_number,

            billDate,

            grandTotal: bill.grand_total,

            paidAmount: bill.paid_amount,

            dueAmount: bill.due_amount

        });

        return res.status(200).json({

            success: true,

            message: "Bill PDF sent successfully through WhatsApp.",

            messageId: result.messageId,

            billNumber: bill.bill_number

        });


    } catch (error) {

        console.error(
            "WhatsApp Bill PDF Error:",
            error.message
        );


        return res.status(500).json({

            success: false,

            message: error.message ||
                "Failed to send bill PDF through WhatsApp."

        });

    }

};


module.exports = {
    sendWhatsAppDueReminder,
    sendWhatsAppBillPdf
};