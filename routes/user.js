const express = require("express");
const router = express.Router();
const authMiddleware = require("../middlewares/auth");

// API hanya bisa diakses jika login
router.get("/profile", authMiddleware, (req, res) => {
  res.json({
    message: "Akses berhasil",
    user: req.user, // id, username, role
  });
});

module.exports = router;
