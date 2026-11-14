const express = require("express"); const router = express.Router();
const { createSHBill, getAllSHBills, getSHBillById, getAllSHCustomers, getSHCustomerBills, recordSHBillPayment, getSHBillPaymentHistory, deleteSHBill } = require("../controllers/shBillController");
const { createDeleteCaptcha } = require("../utils/deleteCaptcha");
router.post("/", createSHBill); router.get("/", getAllSHBills); router.get("/customers", getAllSHCustomers); router.get("/customers/:phone/bills", getSHCustomerBills);
router.get("/delete-captcha", createDeleteCaptcha); router.post("/:id/payments", recordSHBillPayment); router.get("/:id/payments", getSHBillPaymentHistory); router.delete("/:id", deleteSHBill); router.get("/:id", getSHBillById);
module.exports = router;
