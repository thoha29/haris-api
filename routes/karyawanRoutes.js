const express = require('express');
const router = express.Router();
const karyawanController = require('../controllers/KaryawanController');

// Alamat: /api/karyawan/
router.get('/', karyawanController.getKaryawan);

// Endpoint v_listKaryawan
router.get('/v-list', karyawanController.getVListKaryawan);

// Endpoint export Excel
router.get('/export-excel/all', karyawanController.exportExcelAll);
router.get('/export-excel/detail/:id', karyawanController.exportExcelDetail);

// Alamat: /api/karyawan/tambah
router.post('/tambah', karyawanController.tambahKaryawan);

// Alamat: /api/karyawan/update/:id
router.put('/update/:id', karyawanController.updateKaryawan);

// Alamat: /api/karyawan/hapus/:id
router.delete('/hapus/:id', karyawanController.hapusKaryawan);

module.exports = router;