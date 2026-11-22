const pool = require("../config/db");

// ==========================================
// CONSTANTS
// ==========================================

const TRANSACTION_TYPES = ["CREDIT", "DEBIT"];

const CATEGORIES = {
    CREDIT: ["SALES", "INCOME", "OTHERS"],
    DEBIT: ["INVESTMENT", "EXPENSES", "OTHERS"]
};


// ==========================================
// VALIDATION
// ==========================================

const validateTransaction = (data) => {

    const {
        transaction_date,
        amount,
        transaction_type,
        reason,
        e_type
    } = data;

    // Validate date
    if (
        !transaction_date ||
        !/^\d{4}-\d{2}-\d{2}$/.test(transaction_date) ||
        !Number.isFinite(Date.parse(`${transaction_date}T00:00:00Z`)) ||
        new Date(`${transaction_date}T00:00:00Z`)
            .toISOString()
            .slice(0, 10) !== transaction_date
    ) {
        return "Please provide a valid transaction date.";
    }

    // Validate amount
    if (
        amount === undefined ||
        amount === null ||
        amount === "" ||
        !Number.isFinite(Number(amount)) ||
        Number(amount) <= 0
    ) {
        return "Please enter a valid amount greater than zero.";
    }

    // Validate transaction type
    if (!TRANSACTION_TYPES.includes(transaction_type)) {
        return "Invalid transaction type.";
    }

    // Validate category
    if (!CATEGORIES[transaction_type].includes(e_type)) {
        return "Invalid transaction category for selected transaction type.";
    }

    // Validate reason
    if (
        reason !== undefined &&
        reason !== null &&
        typeof reason !== "string"
    ) {
        return "Invalid transaction reason.";
    }

    if (reason && reason.trim().length > 255) {
        return "Transaction reason cannot exceed 255 characters.";
    }

    return null;
};


// ==========================================
// CREATE TRANSACTION
// POST /api/daily-accounts
// ==========================================

const createTransaction = async (req, res) => {

    try {

        const {
            transaction_date,
            amount,
            transaction_type,
            reason,
            e_type
        } = req.body;

        const validationError = validateTransaction(req.body);

        if (validationError) {
            return res.status(400).json({
                success: false,
                message: validationError
            });
        }

        const [result] = await pool.execute(
            `INSERT INTO daily_transactions
            (
                transaction_date,
                amount,
                transaction_type,
                reason,
                e_type
            )
            VALUES (?, ?, ?, ?, ?)`,
            [
                transaction_date,
                Number(amount),
                transaction_type,
                reason ? reason.trim() : null,
                e_type
            ]
        );

        return res.status(201).json({
            success: true,
            message: "Transaction created successfully.",
            transactionId: result.insertId
        });

    } catch (error) {

        console.error("Create Transaction Error:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to create transaction."
        });

    }

};


// ==========================================
// GET ALL TRANSACTIONS
// GET /api/daily-accounts
// ==========================================

const getTransactions = async (req, res) => {

    try {

        const [transactions] = await pool.execute(
            `SELECT
                id,
                transaction_date,
                amount,
                transaction_type,
                reason,
                e_type
             FROM daily_transactions
             ORDER BY transaction_date DESC, id DESC`
        );

        return res.status(200).json({
            success: true,
            transactions
        });

    } catch (error) {

        console.error("Get Transactions Error:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to fetch transactions."
        });

    }

};


// ==========================================
// UPDATE TRANSACTION
// PUT /api/daily-accounts/:id
// ==========================================

const updateTransaction = async (req, res) => {

    try {

        const id = Number(req.params.id);

        if (!Number.isSafeInteger(id) || id <= 0) {
            return res.status(400).json({
                success: false,
                message: "Invalid transaction ID."
            });
        }

        const {
            transaction_date,
            amount,
            transaction_type,
            reason,
            e_type
        } = req.body;

        const validationError = validateTransaction(req.body);

        if (validationError) {
            return res.status(400).json({
                success: false,
                message: validationError
            });
        }

        // Check whether transaction exists
        const [existing] = await pool.execute(
            `SELECT id
             FROM daily_transactions
             WHERE id = ?
             LIMIT 1`,
            [id]
        );

        if (existing.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Transaction not found."
            });
        }

        await pool.execute(
            `UPDATE daily_transactions
             SET
                transaction_date = ?,
                amount = ?,
                transaction_type = ?,
                reason = ?,
                e_type = ?
             WHERE id = ?`,
            [
                transaction_date,
                Number(amount),
                transaction_type,
                reason ? reason.trim() : null,
                e_type,
                id
            ]
        );

        return res.status(200).json({
            success: true,
            message: "Transaction updated successfully."
        });

    } catch (error) {

        console.error("Update Transaction Error:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to update transaction."
        });

    }

};


// ==========================================
// DELETE TRANSACTION
// DELETE /api/daily-accounts/:id
// ==========================================

const deleteTransaction = async (req, res) => {

    try {

        const id = Number(req.params.id);

        if (!Number.isSafeInteger(id) || id <= 0) {
            return res.status(400).json({
                success: false,
                message: "Invalid transaction ID."
            });
        }

        const [result] = await pool.execute(
            `DELETE FROM daily_transactions
             WHERE id = ?`,
            [id]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({
                success: false,
                message: "Transaction not found."
            });
        }

        return res.status(200).json({
            success: true,
            message: "Transaction deleted successfully."
        });

    } catch (error) {

        console.error("Delete Transaction Error:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to delete transaction."
        });

    }

};


// ==========================================
// MONTHLY SUMMARY
// GET /api/daily-accounts/summary/monthly
// ==========================================

const getMonthlySummary = async (req, res) => {

    try {

        const month = Number(req.query.month);
        const year = Number(req.query.year);

        // Validate month and year
        if (
            !Number.isInteger(month) ||
            month < 1 ||
            month > 12 ||
            !Number.isInteger(year) ||
            year < 2000 ||
            year > 9999
        ) {
            return res.status(400).json({
                success: false,
                message: "Please provide a valid month and year."
            });
        }

        // Calculate first and last date of selected month
        const startDate =
            `${year}-${String(month).padStart(2, "0")}-01`;

        const endDate =
            `${year}-${String(month).padStart(2, "0")}-` +
            String(new Date(Date.UTC(year, month, 0)).getUTCDate())
                .padStart(2, "0");

        const [rows] = await pool.execute(
            `SELECT

                COALESCE(
                    SUM(
                        CASE
                            WHEN transaction_type = 'CREDIT'
                            THEN amount
                            ELSE 0
                        END
                    ), 0
                ) AS totalCredit,

                COALESCE(
                    SUM(
                        CASE
                            WHEN transaction_type = 'DEBIT'
                            THEN amount
                            ELSE 0
                        END
                    ), 0
                ) AS totalDebit

             FROM daily_transactions

             WHERE transaction_date >= ?
             AND transaction_date < DATE_ADD(?, INTERVAL 1 DAY)`,
            [
                startDate,
                endDate
            ]
        );

        const totalCredit = Number(rows[0].totalCredit);
        const totalDebit = Number(rows[0].totalDebit);

        const netBalance = totalCredit - totalDebit;

        return res.status(200).json({
            success: true,
            month,
            year,
            totalCredit,
            totalDebit,
            netBalance
        });

    } catch (error) {

        console.error("Monthly Summary Error:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to fetch monthly summary."
        });

    }

};


// ==========================================
// EXPORT CONTROLLERS
// ==========================================

module.exports = {
    createTransaction,
    getTransactions,
    updateTransaction,
    deleteTransaction,
    getMonthlySummary
};