const express = require("express");
const router = express.Router();

const {
    createGI,
    getAllGICustomers,
    recordGIPayment,
    getGIHistory,
    getGIStatistics
} = require("../controllers/giController");


// CREATE GI ACCOUNT
router.post("/", createGI);


// GET GI CUSTOMERS
router.get("/customers", getAllGICustomers);


// RECORD GI PAYMENT
router.post("/payment", recordGIPayment);


// GET GI HISTORY
router.get("/history", getGIHistory);


// GET GI STATISTICS
router.get("/statistics", getGIStatistics);


module.exports = router;