const express = require('express');
const router = express.Router();
const karyawanController = require('../controllers/KaryawanController');

// Alamat aslinya nanti jadi: /api/karyawan/
router.get('/', karyawanController.getKaryawan);

// Alamat aslinya nanti jadi: /api/karyawan/tambah
router.post('/tambah', karyawanController.tambahKaryawan);

// Alamat aslinya nanti jadi: /api/karyawan/update/:id
router.put('/update/:id', karyawanController.updateKaryawan);

// Alamat aslinya nanti jadi: /api/karyawan/hapus/:id
router.delete('/hapus/:id', karyawanController.hapusKaryawan);

module.exports = router;