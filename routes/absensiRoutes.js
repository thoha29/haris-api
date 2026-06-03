const express = require("express");
const router = express.Router();
const absensiController = require("../controllers/AbsensiController");

// --- ENDPOINT APPROVAL BERJENJANG (2 TAHAP) ---

// Tahap 1: User / Atasan (Melihat & Approve data pending awal)
router.get("/hrd/pending-user", absensiController.getPendingUser);
router.put("/hrd/approve-user", absensiController.approveByUser);

// Tahap 2: HRD (Melihat & Approve data yang sudah lolos dari User)



// --- HRD ENDPOINTS ---
// Rute untuk monitoring daftar semua karyawan oleh HRD
router.get("/hrd/list-karyawan", absensiController.getListKaryawan);

// Rute untuk monitoring riwayat detail per karyawan oleh HRD
router.get("/hrd/riwayat/:id_user", absensiController.getRiwayat);

// Rute untuk download laporan excel
router.get("/hrd/download-excel/:id_user", absensiController.exportExcel);

// Rute untuk edit riwayat absensi oleh HRD
router.put("/hrd/edit-absensi/:id_data_absensi", absensiController.editAbsensiHRD);


// --- KARYAWAN ENDPOINTS ---
// Rute untuk menu riwayat di dashboard karyawan
router.get("/riwayat/:id_user", absensiController.getRiwayat);

// Rute untuk proses check-in
router.post("/checkin", absensiController.postCheckIn);

// Rute untuk proses check-out
router.put("/checkout", absensiController.updateCheckOut);


// --- GLOBAL ---
// Rute dasar untuk melihat semua data (Admin)
router.get("/", absensiController.getAllAbsensi);

module.exports = router;
