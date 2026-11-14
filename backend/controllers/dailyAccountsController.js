const db = require("../config/db");

// ==========================================
// 1. ADD NEW TRANSACTION
// ==========================================

exports.createTransaction = async (req, res) => {
  try {
    const {
      transaction_date,
      amount,
      transaction_type,
      reason,
      e_type,
    } = req.body;

    // Validate required fields
    if (
      !transaction_date ||
      amount === undefined ||
      !transaction_type ||
      !e_type
    ) {
      return res.status(400).json({
        success: false,
        message: "Please provide all required fields.",
      });
    }

    const validTypes = ["CREDIT", "DEBIT"];

    const validETypes = [
      "SALES",
      "INVESTMENT",
      "EXPENSES",
      "INCOME",
      "OTHERS",
    ];

    if (!validTypes.includes(transaction_type)) {
      return res.status(400).json({
        success: false,
        message: "Invalid transaction type.",
      });
    }

    if (!validETypes.includes(e_type)) {
      return res.status(400).json({
        success: false,
        message: "Invalid transaction category.",
      });
    }

    // CREDIT / DEBIT validation
    const creditCategories = ["SALES", "INCOME"];
    const debitCategories = ["INVESTMENT", "EXPENSES"];

    if (
      creditCategories.includes(e_type) &&
      transaction_type !== "CREDIT"
    ) {
      return res.status(400).json({
        success: false,
        message: "Sales and Income must be CREDIT transactions.",
      });
    }

    if (
      debitCategories.includes(e_type) &&
      transaction_type !== "DEBIT"
    ) {
      return res.status(400).json({
        success: false,
        message: "Investment and Expenses must be DEBIT transactions.",
      });
    }

    const numericAmount = Number(amount);

    if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
      return res.status(400).json({
        success: false,
        message: "Amount must be greater than zero.",
      });
    }

    const [result] = await db.query(
      `INSERT INTO daily_transactions
       (transaction_date, amount, transaction_type, reason, e_type)
       VALUES (?, ?, ?, ?, ?)`,
      [
        transaction_date,
        numericAmount,
        transaction_type,
        reason || null,
        e_type,
      ]
    );

    res.status(201).json({
      success: true,
      message: "Transaction added successfully.",
      transactionId: result.insertId,
    });
  } catch (error) {
    console.error("Create Transaction Error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to create transaction.",
    });
  }
};


// ==========================================
// 2. GET ALL TRANSACTIONS
// ==========================================

exports.getTransactions = async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT *
       FROM daily_transactions
       ORDER BY transaction_date DESC, id DESC`
    );

    res.status(200).json({
      success: true,
      transactions: rows,
    });
  } catch (error) {
    console.error("Get Transactions Error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to fetch transactions.",
    });
  }
};


// ==========================================
// 3. UPDATE TRANSACTION
// ==========================================

exports.updateTransaction = async (req, res) => {
  try {
    const { id } = req.params;

    const {
      transaction_date,
      amount,
      transaction_type,
      reason,
      e_type,
    } = req.body;

    if (
      !transaction_date ||
      amount === undefined ||
      !transaction_type ||
      !e_type
    ) {
      return res.status(400).json({
        success: false,
        message: "Please provide all required fields.",
      });
    }

    const validTypes = ["CREDIT", "DEBIT"];

    const validETypes = [
      "SALES",
      "INVESTMENT",
      "EXPENSES",
      "INCOME",
      "OTHERS",
    ];

    if (
      !validTypes.includes(transaction_type) ||
      !validETypes.includes(e_type)
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid transaction type or category.",
      });
    }

    const creditCategories = ["SALES", "INCOME"];
    const debitCategories = ["INVESTMENT", "EXPENSES"];

    if (
      creditCategories.includes(e_type) &&
      transaction_type !== "CREDIT"
    ) {
      return res.status(400).json({
        success: false,
        message: "Sales and Income must be CREDIT transactions.",
      });
    }

    if (
      debitCategories.includes(e_type) &&
      transaction_type !== "DEBIT"
    ) {
      return res.status(400).json({
        success: false,
        message: "Investment and Expenses must be DEBIT transactions.",
      });
    }

    const numericAmount = Number(amount);

    if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
      return res.status(400).json({
        success: false,
        message: "Amount must be greater than zero.",
      });
    }

    const [result] = await db.query(
      `UPDATE daily_transactions
       SET transaction_date = ?,
           amount = ?,
           transaction_type = ?,
           reason = ?,
           e_type = ?
       WHERE id = ?`,
      [
        transaction_date,
        numericAmount,
        transaction_type,
        reason || null,
        e_type,
        id,
      ]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({
        success: false,
        message: "Transaction not found.",
      });
    }

    res.status(200).json({
      success: true,
      message: "Transaction updated successfully.",
    });
  } catch (error) {
    console.error("Update Transaction Error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to update transaction.",
    });
  }
};


// ==========================================
// 4. DELETE TRANSACTION
// ==========================================

exports.deleteTransaction = async (req, res) => {
  try {
    const { id } = req.params;

    const [result] = await db.query(
      "DELETE FROM daily_transactions WHERE id = ?",
      [id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({
        success: false,
        message: "Transaction not found.",
      });
    }

    res.status(200).json({
      success: true,
      message: "Transaction deleted successfully.",
    });
  } catch (error) {
    console.error("Delete Transaction Error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to delete transaction.",
    });
  }
};


// ==========================================
// 5. GET MONTHLY SUMMARY
// ==========================================

exports.getMonthlySummary = async (req, res) => {
  try {
    const { month, year } = req.query;

    const currentDate = new Date();

    const selectedMonth = month
      ? Number(month)
      : currentDate.getMonth() + 1;

    const selectedYear = year
      ? Number(year)
      : currentDate.getFullYear();

    if (
      !Number.isInteger(selectedMonth) ||
      selectedMonth < 1 ||
      selectedMonth > 12 ||
      !Number.isInteger(selectedYear) ||
      selectedYear < 1000 ||
      selectedYear > 9999
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid month or year.",
      });
    }

    const [rows] = await db.query(
      `SELECT
          COALESCE(SUM(
            CASE WHEN transaction_type = 'CREDIT'
            THEN amount ELSE 0 END
          ), 0) AS total_credit,

          COALESCE(SUM(
            CASE WHEN transaction_type = 'DEBIT'
            THEN amount ELSE 0 END
          ), 0) AS total_debit

       FROM daily_transactions

       WHERE MONTH(transaction_date) = ?
       AND YEAR(transaction_date) = ?`,
      [selectedMonth, selectedYear]
    );

    const totalCredit = Number(rows[0].total_credit);
    const totalDebit = Number(rows[0].total_debit);

    res.status(200).json({
      success: true,
      month: selectedMonth,
      year: selectedYear,
      totalCredit,
      totalDebit,
      netBalance: totalCredit - totalDebit,
    });
  } catch (error) {
    console.error("Monthly Summary Error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to fetch monthly summary.",
    });
  }
};