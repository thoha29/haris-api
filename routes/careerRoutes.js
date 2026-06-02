const express = require('express');
const router = express.Router();
const careerController = require('../controllers/CareerController');
const multer = require('multer');
const path = require('path');

// Setting simpan foto
const storage = multer.diskStorage({
    destination: 'public/uploads/riwayat/',
    filename: (req, file, cb) => {
        cb(null, Date.now() + path.extname(file.originalname));
    }
});
const upload = multer({ storage: storage });

// ROUTES
// 1. Lihat Riwayat (Tampilan Read-Only)
router.get('/riwayat', careerController.getCareer);
// 2. Input Riwayat (Hanya POST, tidak ada UPDATE)
router.post('/riwayat/simpan', upload.single('foto_bukti'), careerController.storeCareer);

module.exports = router;