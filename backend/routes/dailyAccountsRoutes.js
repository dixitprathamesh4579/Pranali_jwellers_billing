const express = require("express");

const router = express.Router();

const {
  createTransaction,
  getTransactions,
  updateTransaction,
  deleteTransaction,
  getMonthlySummary,
} = require("../controllers/dailyAccountsController");

// Monthly summary
router.get("/summary/monthly", getMonthlySummary);

// Transaction CRUD
router.post("/", createTransaction);
router.get("/", getTransactions);
router.put("/:id", updateTransaction);
router.delete("/:id", deleteTransaction);

module.exports = router;