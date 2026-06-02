const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const controller = require('../controllers/DokumenPribadiController');

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const dir = 'public/uploads/dokumen';
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        cb(null, dir);
    },
    filename: (req, file, cb) => {
        cb(null, `DOK-${Date.now()}${path.extname(file.originalname)}`);
    }
});

const upload = multer({ storage: storage });

// POST: /api/dokumen/upload
router.post('/upload', upload.single('file'), controller.uploadDokumen);

// GET: /api/dokumen/user/:id_user
// SESUAIKAN: ganti getDokumenByUser menjadi getByUserId agar sama dengan Controller kamu
router.get('/user/:id_user', controller.getByUserId);

module.exports = router;