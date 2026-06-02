const express = require("express");
const router = express.Router();
const jadwalController = require("../controllers/JadwalController");

router.get("/list", jadwalController.listJadwal);
router.post("/assign", jadwalController.setJadwal);
router.post("/assign-bulk", jadwalController.setJadwalBulk);

// Ubah dari /user/:id menjadi /detail/:id_user agar cocok dengan Frontend
router.get("/detail/:id_user", jadwalController.getJadwalByUser);
router.get("/check/:id_user", jadwalController.checkTodaySchedule);
router.get("/daily", jadwalController.getDaily);
router.delete("/delete", jadwalController.deleteJadwal);
router.delete("/delete-bulk", jadwalController.deleteJadwalBulk);

module.exports = router;