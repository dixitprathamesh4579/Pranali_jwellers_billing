const express = require("express");
const router = express.Router();

const {
    createSHBill,
    getAllSHBills,
    getSHBillById,
    getAllSHCustomers,
    getSHCustomerBills,
    recordSHBillPayment,
    getSHBillPaymentHistory
} = require("../controllers/shBillController");

// 1. Create SH Bill
router.post("/", createSHBill);

// 2. Get all SH Bills
router.get("/", getAllSHBills);

// 3. Get all SH Customers
router.get("/customers", getAllSHCustomers);

// 4. Get customer bill history
router.get("/customers/:phone/bills", getSHCustomerBills);

// 5. Get SH Bill by ID
// Keep this route LAST.
router.get("/:id", getSHBillById);

router.post("/:id/payments", recordSHBillPayment);
router.get("/:id/payments", getSHBillPaymentHistory);

module.exports = router;