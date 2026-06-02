const express = require('express');
const router = express.Router();

// Import file route individual
const authRoutes = require('./auth');
const dataPribadiRoutes = require('./DataPribadiRoutes');

// Definisikan prefix untuk masing-masing modul
router.use('/api/auth', authRoutes);
router.use('/api/data-pribadi', dataPribadiRoutes);

// Route testing untuk memastikan API aktif
router.get('/', (req, res) => {
    res.json({ message: "Welcome to HRIS API" });
});

module.exports = router;