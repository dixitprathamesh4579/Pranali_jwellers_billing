const express = require("express");
const router = express.Router();

const authenticateToken = require("../middleware/authmiddleware");

const {
    createGI,
    getAllGICustomers,
    recordGIPayment,
    getGIHistory,
    getGIStatistics,
    deleteGIAccount
} = require("../controllers/giController");

const { createDeleteCaptcha } = require("../utils/deleteCaptcha");

// Protect all GI routes
router.use(authenticateToken);

// GI operations
router.post("/", createGI);
router.get("/customers", getAllGICustomers);
router.post("/payment", recordGIPayment);
router.get("/history", getGIHistory);
router.get("/statistics", getGIStatistics);

// Delete CAPTCHA
router.get("/delete-captcha", createDeleteCaptcha);

// Delete GI account
router.delete("/:id", deleteGIAccount);

module.exports = router;