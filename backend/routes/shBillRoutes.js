const express = require("express");
const router = express.Router();

const authenticateToken = require("../middleware/authmiddleware");

const {
    createSHBill,
    getAllSHBills,
    getSHBillById,
    getAllSHCustomers,
    getSHCustomerBills,
    recordSHBillPayment,
    getSHBillPaymentHistory,
    deleteSHBill
} = require("../controllers/shBillController");

const { createDeleteCaptcha } = require("../utils/deleteCaptcha");

// Protect all SH Bill routes
router.use(authenticateToken);

// Create and fetch bills
router.post("/", createSHBill);
router.get("/", getAllSHBills);

// Customer operations
router.get("/customers", getAllSHCustomers);
router.get("/customers/:phone/bills", getSHCustomerBills);

// Delete CAPTCHA
router.get("/delete-captcha", createDeleteCaptcha);

// Payment operations
router.post("/:id/payments", recordSHBillPayment);
router.get("/:id/payments", getSHBillPaymentHistory);

// Delete bill
router.delete("/:id", deleteSHBill);

// Fetch individual bill
router.get("/:id", getSHBillById);

module.exports = router;