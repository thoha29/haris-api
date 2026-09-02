const express = require('express');
const router = express.Router();
const SppdController = require('../controllers/SppdController');

router.post('/', SppdController.createSppd);
router.get('/', SppdController.getAllSppd);
router.get('/:id', SppdController.getSppdById);

// Atasan actions
router.put('/approve-atasan', SppdController.approveByAtasan);    // approve/reject SPPD
router.put('/cancel-atasan', SppdController.cancelByAtasan);       // batalkan SPPD

// HRD actions  
router.put('/approve-hrd', SppdController.approveByHrd);
router.post('/request-cancel', SppdController.requestCancel);
router.put('/approve-cancel-hrd', SppdController.approveCancelHrd);
router.put('/approve-cancel-atasan', SppdController.approveCancelAtasan);

module.exports = router;
