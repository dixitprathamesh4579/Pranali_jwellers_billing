const pool = require("../config/db");

// Convert 0 -> A, 25 -> Z, 26 -> AA, 27 -> AB, etc.
const numberToLetters = (number) => {
    let result = "";
    let n = number + 1;

    while (n > 0) {
        n--;

        result =
            String.fromCharCode(65 + (n % 26)) + result;

        n = Math.floor(n / 26);
    }

    return result;
};

// Convert A -> 0, Z -> 25, AA -> 26, AB -> 27, etc.
const lettersToNumber = (letters) => {
    let result = 0;

    for (const letter of letters) {
        result = result * 26 + (letter.charCodeAt(0) - 64);
    }

    return result - 1;
};

// Convert a global bill count into A-1, A-2 ... AA-1, etc.
const formatBillNumber = (number) => {
    const groupIndex = Math.floor((number - 1) / 100);
    const sequence = ((number - 1) % 100) + 1;

    return `${numberToLetters(groupIndex)}-${sequence}`;
};

// Convert an existing bill number into its global sequence number.
const parseBillNumber = (billNumber) => {
    const match = /^([A-Z]+)-(\d+)$/.exec(billNumber || "");

    if (!match) return 0;

    const groupIndex = lettersToNumber(match[1]);
    const sequence = Number(match[2]);

    if (sequence < 1 || sequence > 100) return 0;

    return groupIndex * 100 + sequence;
};

// CREATE NEW SH BILL
// CREATE NEW SH BILL
const createSHBill = async (req, res) => {
    const connection = await pool.getConnection();

    try {
        const {
            billing_type,
            bill_date,
            customer_name,
            customer_phone,
            customer_address,
            items,
            subtotal,
            discount_amount,
            gst_amount,
            grand_total,
            paid_amount,
            due_amount,
            exchange_items,
            exchange_total,
            net_payable
        } = req.body;

        // Basic validation
        if (
            !billing_type ||
            !bill_date ||
            !customer_name ||
            !customer_phone ||
            !Array.isArray(items) ||
            items.length === 0
        ) {
            return res.status(400).json({
                success: false,
                message: "Please provide all required bill details."
            });
        }

        if (!["GST", "WITHOUT_GST"].includes(billing_type)) {
            return res.status(400).json({
                success: false,
                message: "Invalid billing type."
            });
        }

        if (!/^\d{10}$/.test(String(customer_phone))) {
            return res.status(400).json({
                success: false,
                message: "Customer phone must contain 10 digits."
            });
        }

        await connection.beginTransaction();

        // Lock the sequence row.
        // This ensures that simultaneous users cannot get the same number.
        const [sequenceRows] = await connection.query(
            `SELECT last_number
             FROM sh_bill_number_sequence
             WHERE id = 1
             FOR UPDATE`
        );

        if (sequenceRows.length === 0) {
            throw new Error("SH bill sequence row is missing.");
        }

        let lastNumber = Number(sequenceRows[0].last_number);

        /*
         * First-time migration:
         * If old bills already exist but the sequence table is new,
         * find the highest existing bill number.
         */
        if (lastNumber === 0) {
            const [existingBills] = await connection.query(
                "SELECT bill_number FROM sh_bills"
            );

            for (const bill of existingBills) {
                lastNumber = Math.max(
                    lastNumber,
                    parseBillNumber(bill.bill_number)
                );
            }
        }

        // Generate the next bill number.
        const nextNumber = lastNumber + 1;
        const bill_number = formatBillNumber(nextNumber);

        // Save bill.
        const [result] = await connection.query(
            `INSERT INTO sh_bills (
                bill_number,
                billing_type,
                bill_date,
                customer_name,
                customer_phone,
                customer_address,
                items,
                subtotal,
                discount_amount,
                gst_amount,
                grand_total,
                paid_amount,
                due_amount,
                exchange_items,
                exchange_total,
                net_payable
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                bill_number,
                billing_type,
                bill_date,
                customer_name,
                customer_phone,
                customer_address || null,
                JSON.stringify(items),
                subtotal,
                discount_amount,
                gst_amount,
                grand_total,
                paid_amount,
                due_amount,
                JSON.stringify(exchange_items || []),
                exchange_total || 0,
                net_payable ?? grand_total
            ]
        );

        // Update sequence only after successful bill insertion.
        await connection.query(
            `UPDATE sh_bill_number_sequence
             SET last_number = ?
             WHERE id = 1`,
            [nextNumber]
        );

        await connection.commit();

        return res.status(201).json({
            success: true,
            message: "SH Bill saved successfully!",
            bill_id: result.insertId,
            bill_number
        });



    } finally {
        connection.release();
    }
};
// GET ALL SH BILLS
const getAllSHBills = async (req, res) => {
    try {
        const [bills] = await pool.execute(
            "SELECT * FROM sh_bills ORDER BY created_at DESC"
        );

        return res.status(200).json({
            success: true,
            count: bills.length,
            bills
        });

    } catch (error) {
        console.error("Get SH Bills Error:", error.message);

        return res.status(500).json({
            success: false,
            message: "Failed to fetch SH Bills."
        });
    }
};

// GET ALL SH CUSTOMERS WITH SEARCH AND FILTER
const getAllSHCustomers = async (req, res) => {
    try {
        const { search = "", filter = "all" } = req.query;

        const searchValue = `%${search.trim()}%`;

        let sql = `
            SELECT
                MAX(b.customer_name) AS customer_name,
                b.customer_phone,
                MAX(b.customer_address) AS customer_address,

                COUNT(*) AS total_bills,

                SUM(b.grand_total) AS total_purchase,

                SUM(b.paid_amount) AS total_paid,

                SUM(b.due_amount) AS total_due,

                MAX(b.bill_date) AS last_bill_date

            FROM sh_bills b

            WHERE (
                ? = ''
                OR b.customer_name LIKE ?
                OR b.customer_phone LIKE ?
                OR EXISTS (
                    SELECT 1
                    FROM sh_bills sb
                    WHERE sb.customer_phone = b.customer_phone
                    AND sb.bill_number LIKE ?
                )
            )

            GROUP BY b.customer_phone
        `;

        if (filter === "pending") {
            sql += ` HAVING SUM(b.due_amount) > 0 `;
        }

        if (filter === "paid") {
            sql += ` HAVING SUM(b.due_amount) = 0 `;
        }

        sql += ` ORDER BY MAX(b.created_at) DESC`;

        const [customers] = await pool.execute(sql, [
            search.trim(),
            searchValue,
            searchValue,
            searchValue
        ]);

        return res.status(200).json({
            success: true,
            count: customers.length,
            customers
        });

    } catch (error) {
        console.error("Get SH Customers Error:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to fetch SH Customers."
        });
    }
};
// GET CUSTOMER BILL HISTORY
const getSHCustomerBills = async (req, res) => {
    try {
        const { phone } = req.params;

        const [bills] = await pool.execute(
            `
            SELECT *
            FROM sh_bills
            WHERE customer_phone = ?
            ORDER BY bill_date DESC, id DESC
            `,
            [phone]
        );

        if (bills.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Customer bills not found."
            });
        }

        return res.status(200).json({
            success: true,
            count: bills.length,
            bills
        });

    } catch (error) {
        console.error("Get Customer Bills Error:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to fetch customer bill history."
        });
    }
};
// GET SH BILL BY ID
const getSHBillById = async (req, res) => {
    try {
        const { id } = req.params;

        const [bills] = await pool.execute(
            "SELECT * FROM sh_bills WHERE id = ?",
            [id]
        );

        if (bills.length === 0) {
            return res.status(404).json({
                success: false,
                message: "SH Bill not found."
            });
        }

        return res.status(200).json({
            success: true,
            bill: bills[0]
        });

    } catch (error) {
        console.error("Get SH Bill Error:", error.message);

        return res.status(500).json({
            success: false,
            message: "Failed to fetch SH Bill."
        });
    }
};

// RECORD PAYMENT
const recordSHBillPayment = async (req, res) => {
    const connection = await pool.getConnection();

    try {
        const { id } = req.params;
        const {
            payment_amount,
            payment_date,
            payment_mode,
            remarks
        } = req.body;

        const billId = Number(id);
        const amount = Number(payment_amount);

        if (!Number.isInteger(billId) || billId <= 0) {
            return res.status(400).json({
                success: false,
                message: "Invalid bill ID."
            });
        }

        if (!Number.isFinite(amount) || amount <= 0) {
            return res.status(400).json({
                success: false,
                message: "Payment amount must be greater than zero."
            });
        }

        if (!payment_date) {
            return res.status(400).json({
                success: false,
                message: "Payment date is required."
            });
        }

        const allowedModes = [
            "CASH",
            "UPI",
            "BANK_TRANSFER",
            "CARD",
            "OTHER"
        ];

        const mode = payment_mode || "CASH";

        if (!allowedModes.includes(mode)) {
            return res.status(400).json({
                success: false,
                message: "Invalid payment mode."
            });
        }

        await connection.beginTransaction();

        // Lock the bill row to prevent simultaneous payment updates.
        const [bills] = await connection.query(
            `SELECT id, grand_total, paid_amount, due_amount
             FROM sh_bills
             WHERE id = ?
             FOR UPDATE`,
            [billId]
        );

        if (bills.length === 0) {
            await connection.rollback();

            return res.status(404).json({
                success: false,
                message: "SH Bill not found."
            });
        }

        const bill = bills[0];
        const currentDue = Number(bill.due_amount);

        if (currentDue <= 0) {
            await connection.rollback();

            return res.status(400).json({
                success: false,
                message: "This bill has no pending dues."
            });
        }

        if (amount > currentDue + 0.001) {
            await connection.rollback();

            return res.status(400).json({
                success: false,
                message: `Payment cannot exceed pending due of ₹${currentDue.toFixed(2)}.`
            });
        }

        // Save payment history.
        const [paymentResult] = await connection.query(
            `INSERT INTO sh_bill_payments
             (bill_id, payment_amount, payment_date, payment_mode, remarks)
             VALUES (?, ?, ?, ?, ?)`,
            [
                billId,
                amount,
                payment_date,
                mode,
                remarks || null
            ]
        );

        // Update bill totals.
        await connection.query(
            `UPDATE sh_bills
             SET paid_amount = paid_amount + ?,
                 due_amount = due_amount - ?
             WHERE id = ?`,
            [amount, amount, billId]
        );

        const [updatedBills] = await connection.query(
            `SELECT
        id,
        bill_number,
        grand_total,
        exchange_total,
        net_payable,
        paid_amount,
        due_amount
     FROM sh_bills
     WHERE id = ?`,
            [billId]
        );

        await connection.commit();

        return res.status(201).json({
            success: true,
            message: "Payment recorded successfully!",
            payment_id: paymentResult.insertId,
            bill: updatedBills[0]
        });

    } catch (error) {
        await connection.rollback();

        console.error("Record Payment Error:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to record payment."
        });

    } finally {
        connection.release();
    }
};


// GET PAYMENT HISTORY
const getSHBillPaymentHistory = async (req, res) => {
    try {
        const { id } = req.params;

        const [bills] = await pool.query(
            "SELECT id FROM sh_bills WHERE id = ?",
            [id]
        );

        if (bills.length === 0) {
            return res.status(404).json({
                success: false,
                message: "SH Bill not found."
            });
        }

        const [payments] = await pool.query(
            `SELECT id, bill_id, payment_amount, payment_date,
                    payment_mode, remarks, created_at
             FROM sh_bill_payments
             WHERE bill_id = ?
             ORDER BY payment_date DESC, id DESC`,
            [id]
        );

        return res.status(200).json({
            success: true,
            payments
        });

    } catch (error) {
        console.error("Payment History Error:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to fetch payment history."
        });
    }
};

module.exports = {
    createSHBill,
    getAllSHBills,
    getSHBillById,
    getAllSHCustomers,
    getSHCustomerBills,
    recordSHBillPayment,
    getSHBillPaymentHistory
};