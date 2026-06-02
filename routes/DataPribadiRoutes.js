const express = require('express');
const router = express.Router();
const controller = require('../controllers/DataPribadiController');
const { verifyToken, authorizeRole } = require('../middlewares/auth');
const db = require('../config/db');

// ==========================================
// 1. ENDPOINT DROPDOWN (KARYAWAN ALL ROLE)
// ==========================================
router.get('/users/list', verifyToken, authorizeRole('hrd'), (req, res) => {
    // Query ini ngambil SEMUA user yang bukan pimpinan/hrd
    // Tanpa LEFT JOIN IS NULL biar yang sudah punya data tetap muncul buat diedit
    const query = `
        SELECT id_user, username 
        FROM users 
        WHERE role NOT IN ('pimpinan', 'hrd') 
        ORDER BY username ASC
    `;

    db.query(query, (err, results) => {
        if (err) return res.status(500).json({ message: "Gagal load user: " + err.message });
        res.json(results);
    });
});

// ==========================================
// 2. CRUD DATA PRIBADI (FULL 18 KOLOM)
// ==========================================

// Create - Simpan Data Baru
router.post('/', verifyToken, authorizeRole('hrd'), controller.createKaryawan);

// Read All - Ambil Semua Data
router.get('/', verifyToken, authorizeRole('hrd', 'pimpinan'), controller.getAllKaryawan);

// Read One - Detail User untuk Auto-fill
router.get('/:id', verifyToken, authorizeRole('hrd', 'karyawan'), controller.getKaryawanById);

// Update - Edit Data Karyawan
router.put('/:id', verifyToken, authorizeRole('hrd'), controller.updateKaryawan);

module.exports = router;