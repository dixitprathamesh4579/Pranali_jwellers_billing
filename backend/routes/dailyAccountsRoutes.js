const express = require("express");
const router = express.Router();

const authenticateToken = require("../middleware/authmiddleware");

const {
    createTransaction,
    getTransactions,
    updateTransaction,
    deleteTransaction,
    getMonthlySummary,
} = require("../controllers/dailyAccountsController");

router.use(authenticateToken);

router.get("/summary/monthly", getMonthlySummary);
router.post("/", createTransaction);
router.get("/", getTransactions);
router.put("/:id", updateTransaction);
router.delete("/:id", deleteTransaction);

module.exports = router;