const pool = require("../config/db");

// CREATE NEW SH BILL
// CREATE NEW SH BILL
const createSHBill = async (req, res) => {
    const connection = await pool.getConnection();

    try {
        const {
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
            exchange_items = [],
            exchange_total = 0,
            net_payable,
            paid_amount
        } = req.body;

        // BASIC VALIDATION
        if (
            !bill_number ||
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

        // EXCHANGE VALIDATION
        if (!Array.isArray(exchange_items)) {
            return res.status(400).json({
                success: false,
                message: "Invalid exchange items."
            });
        }

        const grandTotal = Number(grand_total);
        const exchangeTotal = Number(exchange_total);
        const paidAmount = Number(paid_amount);

        if (
            !Number.isFinite(grandTotal) ||
            !Number.isFinite(exchangeTotal) ||
            !Number.isFinite(paidAmount) ||
            grandTotal <= 0 ||
            exchangeTotal < 0 ||
            paidAmount < 0
        ) {
            return res.status(400).json({
                success: false,
                message: "Invalid bill amounts."
            });
        }

        const calculatedNetPayable = Number(
            (grandTotal - exchangeTotal).toFixed(2)
        );

        if (calculatedNetPayable < 0) {
            return res.status(400).json({
                success: false,
                message: "Exchange value cannot exceed the grand total."
            });
        }

        if (
            net_payable !== undefined &&
            Math.abs(Number(net_payable) - calculatedNetPayable) > 0.01
        ) {
            return res.status(400).json({
                success: false,
                message: "Net payable amount calculation is incorrect."
            });
        }

        if (paidAmount > calculatedNetPayable + 0.001) {
            return res.status(400).json({
                success: false,
                message: "Paid amount cannot exceed net payable amount."
            });
        }

        const finalDue = Number(
            (calculatedNetPayable - paidAmount).toFixed(2)
        );

        await connection.beginTransaction();

        const sql = `
            INSERT INTO sh_bills (
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
                exchange_items,
                exchange_total,
                net_payable,
                paid_amount,
                due_amount
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `;

        const values = [
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
            grandTotal,
            JSON.stringify(exchange_items),
            exchangeTotal,
            calculatedNetPayable,
            paidAmount,
            finalDue
        ];

        const [result] = await connection.execute(sql, values);

        // Save initial payment in payment history.
        if (paidAmount > 0) {
            await connection.execute(
                `INSERT INTO sh_bill_payments
                 (bill_id, payment_amount, payment_date, payment_mode, remarks)
                 VALUES (?, ?, ?, 'CASH', ?)`,
                [
                    result.insertId,
                    paidAmount,
                    bill_date,
                    "Initial payment recorded with bill"
                ]
            );
        }

        await connection.commit();

        return res.status(201).json({
            success: true,
            message: "SH Bill saved successfully!",
            bill_id: result.insertId,
            bill_number,
            grand_total: grandTotal,
            exchange_total: exchangeTotal,
            net_payable: calculatedNetPayable,
            paid_amount: paidAmount,
            due_amount: finalDue
        });

    } catch (error) {
        await connection.rollback();

        console.error("Create SH Bill Error:", error);

        if (error.code === "ER_DUP_ENTRY") {
            return res.status(409).json({
                success: false,
                message: "This bill number already exists."
            });
        }

        return res.status(500).json({
            success: false,
            message: "Failed to save SH Bill."
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