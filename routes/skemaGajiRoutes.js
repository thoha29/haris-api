const express = require("express");
const router = express.Router();
const skemaGajiController = require("../controllers/SkemaGajiController");

// Ambil semua skema gaji
router.get("/", skemaGajiController.getDaftarSkemaGaji);
router.get("/:id", skemaGajiController.getSkemaGajiById);

// CRUD buat HRD / Keuangan
router.post("/add", skemaGajiController.tambahSkemaGaji);
router.put("/edit/:id", skemaGajiController.updateSkemaGaji);
router.delete("/delete/:id", skemaGajiController.hapusSkemaGaji);

module.exports = router;
