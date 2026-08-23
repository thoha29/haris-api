const express = require('express');
const router = express.Router();
const PengaturanSkemaController = require('../controllers/PengaturanSkemaController');

router.get('/', PengaturanSkemaController.getAllPengaturan);
router.get('/:key', PengaturanSkemaController.getPengaturanByKey);
router.put('/', PengaturanSkemaController.updatePengaturan);
router.put('/bulk', PengaturanSkemaController.updatePengaturanBulk);

module.exports = router;
