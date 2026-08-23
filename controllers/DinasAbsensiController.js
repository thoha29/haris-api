const DinasAbsensiModel = require('../models/DinasAbsensiModel');

exports.checkStatusToday = (req, res) => {
  const id_user = req.user ? req.user.id_user : req.query.id_user;
  const tanggal = req.query.tanggal || new Date().toISOString().split('T')[0];

  if (!id_user) {
    return res.status(400).json({ error: 'id_user wajib diisi!' });
  }

  DinasAbsensiModel.checkActiveDinasToday(id_user, tanggal, (err, dinasRows) => {
    if (err) return res.status(500).json({ error: err.message });
    if (dinasRows.length === 0) {
      return res.json({ hasActiveDinas: false, message: 'Tidak ada surat tugas dinas aktif untuk hari ini' });
    }

    const sppd = dinasRows[0];

    DinasAbsensiModel.checkTodayDinasAbsensi(id_user, tanggal, (err2, absensiRows) => {
      if (err2) return res.status(500).json({ error: err2.message });
      const hasCheckedIn = absensiRows.length > 0;

      res.json({
        hasActiveDinas: true,
        sppd,
        hasCheckedIn,
        absensiToday: hasCheckedIn ? absensiRows[0] : null,
      });
    });
  });
};

exports.postCheckInDinas = (req, res) => {
  const data = req.body;
  const id_user = req.user ? req.user.id_user : req.body.id_user;
  const tanggal = data.tanggal || new Date().toISOString().split('T')[0];
  const jam_masuk = data.jam_masuk || new Date().toTimeString().split(' ')[0];

  if (!id_user) {
    return res.status(400).json({ error: 'id_user wajib diisi!' });
  }

  // 1. Verify active dinas today
  DinasAbsensiModel.checkActiveDinasToday(id_user, tanggal, (err, dinasRows) => {
    if (err) return res.status(500).json({ error: err.message });
    if (dinasRows.length === 0) {
      return res.status(400).json({ error: 'Tidak ada surat tugas dinas aktif hari ini!' });
    }

    // 2. Check if already checked in today
    DinasAbsensiModel.checkTodayDinasAbsensi(id_user, tanggal, (err2, absensiRows) => {
      if (err2) return res.status(500).json({ error: err2.message });
      if (absensiRows.length > 0) {
        return res.status(400).json({ error: 'Anda sudah melakukan absensi dinas hari ini!' });
      }

      const checkInData = {
        id_user,
        tanggal,
        jam_masuk,
        lokasi_absensi: data.lokasi_absensi || dinasRows[0].alamat_tujuan,
        latitude: data.latitude,
        longitude: data.longitude,
      };

      DinasAbsensiModel.checkInDinas(checkInData, (err3, result) => {
        if (err3) return res.status(500).json({ error: err3.message });
        res.status(201).json({
          message: 'Absensi harian dinas berhasil dicatat!',
          id_data_absensi: result.insertId,
        });
      });
    });
  });
};

exports.getHistory = (req, res) => {
  const id_user = req.user ? req.user.id_user : req.params.id_user;
  if (!id_user) return res.status(400).json({ error: 'id_user wajib diisi!' });

  DinasAbsensiModel.getDinasAbsensiHistory(id_user, (err, results) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(results);
  });
};
