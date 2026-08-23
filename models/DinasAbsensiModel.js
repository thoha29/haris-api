const db = require('../config/db');

const DinasAbsensiModel = {
  checkActiveDinasToday: (id_user, tanggal, callback) => {
    const sql = `
      SELECT s.*, r.status AS status_rab
      FROM sppd s
      LEFT JOIN rab r ON s.id_sppd = r.id_sppd
      WHERE s.id_user = ?
        AND ? BETWEEN s.tanggal_mulai AND s.tanggal_selesai
        AND (s.status_sppd = 'active' OR (s.status_sppd = 'approved' AND r.status = 'approved'))
      ORDER BY s.id_sppd DESC
      LIMIT 1
    `;
    db.query(sql, [id_user, tanggal], callback);
  },

  checkTodayDinasAbsensi: (id_user, tanggal, callback) => {
    const sql = `SELECT * FROM absensi WHERE id_user = ? AND tanggal = ?`;
    db.query(sql, [id_user, tanggal], callback);
  },

  checkInDinas: (data, callback) => {
    // Get dynamic skema dinas
    db.query(`SELECT id_skema FROM pengaturan_skema WHERE key_setting = 'skema_dinas'`, (err, settingRows) => {
      const idSkemaDinas = settingRows && settingRows.length > 0 ? settingRows[0].id_skema : 11;

      const sql = `
        INSERT INTO absensi (
          id_user,
          id_skema,
          tanggal,
          jam_masuk,
          jam_keluar,
          status,
          is_approved,
          status_user,
          status_hrd,
          lokasi_absensi,
          latitude,
          longitude,
          keterlambatan,
          lembur,
          total_jam_kerja
        ) VALUES (?, ?, ?, ?, NULL, 'Hadir', 'approved', 'approved', 'approved', ?, ?, ?, 0, 0, 8.00)
      `;

      const values = [
        data.id_user,
        idSkemaDinas,
        data.tanggal,
        data.jam_masuk,
        data.lokasi_absensi || 'Lokasi Dinas',
        data.latitude || null,
        data.longitude || null,
      ];

      db.query(sql, values, callback);
    });
  },

  getDinasAbsensiHistory: (id_user, callback) => {
    const sql = `
      SELECT a.*, s.nomor_sppd, s.alamat_tujuan, s.tugas
      FROM absensi a
      JOIN pengaturan_skema ps ON ps.key_setting = 'skema_dinas' AND a.id_skema = ps.id_skema
      LEFT JOIN sppd s ON s.id_user = a.id_user AND a.tanggal BETWEEN s.tanggal_mulai AND s.tanggal_selesai
      WHERE a.id_user = ?
      ORDER BY a.tanggal DESC
    `;
    db.query(sql, [id_user], callback);
  },
};

module.exports = DinasAbsensiModel;
