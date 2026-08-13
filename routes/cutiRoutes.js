const express = require("express");
const router = express.Router();
const CutiController = require("../controllers/CutiController");

// --- KARYAWAN ---
router.post("/ajukan", CutiController.ajukanCuti);
router.get("/status/:id_user", CutiController.getStatusCuti);
router.get('/sisa/:id_user', CutiController.cekSisaCuti);

// --- TAHAP 1: ATASAN (USER) ---
router.get("/pending-user", CutiController.getPendingUser);
router.get("/riwayat-user", CutiController.getRiwayatUser);
router.put("/approve-user", CutiController.approveCutiByUser);

// --- TAHAP 2: HRD ---
router.get("/pending-hrd", CutiController.getPendingHRD);
router.put("/approve-hrd", CutiController.approveCutiByHRD);

// --- MONITORING & LAPORAN ---
router.get("/semua", CutiController.getSemuaCuti);
router.get("/riwayat-semua", CutiController.getAllCutiHistory);
router.put("/update-status-global", CutiController.updateCutiStatusGlobal);
router.get("/laporan/excel", CutiController.exportCutiExcel);
router.get("/laporan/excel/:id_user", CutiController.exportCutiExcelPerUser);

module.exports = router;