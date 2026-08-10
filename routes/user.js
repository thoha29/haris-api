const express = require("express");
const router = express.Router();
const { verifyToken } = require("../middlewares/auth");
const authController = require("../controllers/authController");

// API hanya bisa diakses jika login
router.get("/profile", verifyToken, (req, res) => {
  res.json({
    message: "Akses berhasil",
    user: req.user, // id, username, role
  });
});

router.post("/change-password", verifyToken, authController.changePassword);
router.put("/change-password", verifyToken, authController.changePassword);

module.exports = router;

