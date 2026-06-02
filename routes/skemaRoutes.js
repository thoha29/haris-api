const express = require("express");
const router = express.Router();
const skemaController = require("../controllers/SkemaController");

// Ambil semua skema
router.get("/", skemaController.getDaftarSkema);

// CRUD buat HRD
router.post("/add", skemaController.tambahSkema);
router.put("/edit/:id", skemaController.updateSkema);
router.delete("/delete/:id", skemaController.hapusSkema);

module.exports = router;