const express = require("express"); const router = express.Router();
const { createGI, getAllGICustomers, recordGIPayment, getGIHistory, getGIStatistics, deleteGIAccount } = require("../controllers/giController");
const { createDeleteCaptcha } = require("../utils/deleteCaptcha");
router.post("/", createGI); router.get("/customers", getAllGICustomers); router.post("/payment", recordGIPayment); router.get("/history", getGIHistory); router.get("/statistics", getGIStatistics); router.get("/delete-captcha", createDeleteCaptcha); router.delete("/:id", deleteGIAccount);
module.exports = router;
