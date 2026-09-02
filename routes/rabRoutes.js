const express = require('express');
const router = express.Router();
const RabController = require('../controllers/RabController');

router.get('/sppd/:id_sppd', RabController.getRabBySppdId);
router.post('/submit', RabController.submitRab);

// Atasan actions
router.put('/review-atasan', RabController.reviewByAtasan);  // approve/minta revisi RAB
router.get('/pending-atasan', RabController.getPendingAtasan);

// HRD actions
router.put('/review-hrd', RabController.reviewByHrd);
router.get('/pending-hrd', RabController.getPendingHrd);

module.exports = router;
