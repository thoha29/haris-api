const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');

// URL jadinya: POST https://api1.ptbss.id/api/auth/login
router.post('/login', authController.login);
// Di file middlewares/auth.js
exports.authorizeRole = (...roles) => {
  return (req, res, next) => {
    // Cek di terminal backend lu, munculnya apa pas lu klik simpan
    console.log('Role dari Token:', req.user?.role);
    console.log('Izin yang dibutuhkan:', roles);

    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({
        message: `Akses Dilarang! Role lu (${req.user?.role}) gak punya izin.`,
      });
    }
    next();
  };
};

module.exports = router;
