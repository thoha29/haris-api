const express = require('express');
const router = express.Router();
const DinasAbsensiController = require('../controllers/DinasAbsensiController');

router.get('/today', DinasAbsensiController.checkStatusToday);
router.post('/checkin', DinasAbsensiController.postCheckInDinas);
router.get('/history/:id_user', DinasAbsensiController.getHistory);

module.exports = router;
