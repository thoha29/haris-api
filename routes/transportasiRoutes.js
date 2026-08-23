const express = require('express');
const router = express.Router();
const TransportasiPerusahaanController = require('../controllers/TransportasiPerusahaanController');

router.get('/', TransportasiPerusahaanController.getAll);
router.get('/:id', TransportasiPerusahaanController.getById);
router.post('/', TransportasiPerusahaanController.create);
router.put('/:id', TransportasiPerusahaanController.update);
router.patch('/:id/status', TransportasiPerusahaanController.updateStatus);
router.delete('/:id', TransportasiPerusahaanController.delete);

module.exports = router;
