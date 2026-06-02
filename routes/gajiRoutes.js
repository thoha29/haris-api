const express = require("express");
const router = express.Router();
const gajiController = require("../controllers/GajiController");


router.post("/proses", gajiController.prosesGajiLengkap);

// Rute untuk melihat riwayat gaji karyawan
router.get("/riwayat/:id_user", gajiController.getRiwayatGaji);

// Rute untuk pimpinan melihat semua gaji
router.get("/all", gajiController.getAllGaji);

// Rute untuk pimpinan mengupdate status gaji
router.put("/status/:id_slip", gajiController.updateStatusGaji);

// Rute untuk pimpinan menghapus data gaji
router.delete("/hapus/:id_slip", gajiController.deleteSlipGaji);

module.exports = router;