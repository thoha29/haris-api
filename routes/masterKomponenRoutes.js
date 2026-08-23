const express = require('express');
const router = express.Router();
const MasterKomponenController = require('../controllers/MasterKomponenController');

router.get('/', MasterKomponenController.getAll);
router.get('/active', MasterKomponenController.getActive);
router.get('/:id', MasterKomponenController.getById);
router.post('/', MasterKomponenController.create);
router.put('/:id', MasterKomponenController.update);
router.patch('/:id/toggle', MasterKomponenController.toggleStatus);
router.delete('/:id', MasterKomponenController.delete);

module.exports = router;
