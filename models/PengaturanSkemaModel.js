const db = require('../config/db');

const PengaturanSkema = {
  getAll: (callback) => {
    const sql = `
      SELECT ps.*, sa.nama_skema, sa.jam_masuk, sa.jam_keluar 
      FROM pengaturan_skema ps
      LEFT JOIN skema_absensi sa ON ps.id_skema = sa.id_skema
      ORDER BY ps.id ASC
    `;
    db.query(sql, callback);
  },

  getByKey: (key_setting, callback) => {
    const sql = `
      SELECT ps.*, sa.nama_skema, sa.jam_masuk, sa.jam_keluar 
      FROM pengaturan_skema ps
      LEFT JOIN skema_absensi sa ON ps.id_skema = sa.id_skema
      WHERE ps.key_setting = ?
    `;
    db.query(sql, [key_setting], callback);
  },

  updateSetting: (key_setting, id_skema, keterangan, callback) => {
    const sql = `
      INSERT INTO pengaturan_skema (key_setting, id_skema, keterangan)
      VALUES (?, ?, ?)
      ON DUPLICATE KEY UPDATE id_skema = VALUES(id_skema), keterangan = VALUES(keterangan)
    `;
    db.query(sql, [key_setting, id_skema, keterangan || null], callback);
  },

  updateBulk: (settingsArray, callback) => {
    if (!settingsArray || settingsArray.length === 0) {
      return callback(null, { affectedRows: 0 });
    }

    const promises = settingsArray.map((item) => {
      const sql = `
        INSERT INTO pengaturan_skema (key_setting, id_skema, keterangan)
        VALUES (?, ?, ?)
        ON DUPLICATE KEY UPDATE id_skema = VALUES(id_skema), keterangan = VALUES(keterangan)
      `;
      return db.query(sql, [item.key_setting, item.id_skema, item.keterangan || null]);
    });

    Promise.all(promises)
      .then((results) => callback(null, results))
      .catch((err) => callback(err));
  },
};

module.exports = PengaturanSkema;
