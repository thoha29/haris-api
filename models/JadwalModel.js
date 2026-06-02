const db = require("../config/db");

const Jadwal = {
    getKaryawanJadwal: (callback) => {
        const sql = `SELECT id_user, username, role FROM users WHERE role IN ('karyawan', 'keuangan') ORDER BY role ASC, username ASC`;
        db.query(sql, callback);
    },

    assignJadwal: (id_user, id_skema, tanggal, callback) => {
        const sql = `INSERT INTO jadwal_karyawan (id_user, id_skema, tanggal) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE id_skema = VALUES(id_skema)`;
        db.query(sql, [id_user, id_skema, tanggal], callback);
    },

    assignJadwalBulk: (valuesArray, callback) => {
        const sql = `INSERT INTO jadwal_karyawan (id_user, id_skema, tanggal) VALUES ? ON DUPLICATE KEY UPDATE id_skema = VALUES(id_skema)`;
        db.query(sql, [valuesArray], callback);
    },

    getJadwalByUserId: (id_user, callback) => {
        const sql = `SELECT jk.*, s.nama_skema, s.jam_masuk, s.jam_keluar FROM jadwal_karyawan jk JOIN skema_absensi s ON jk.id_skema = s.id_skema WHERE jk.id_user = ?`;
        db.query(sql, [id_user], callback);
    },

    getJadwalByDate: (id_user, tanggal, callback) => {
        const sql = `SELECT jk.*, s.nama_skema, s.jam_masuk, s.jam_keluar FROM jadwal_karyawan jk JOIN skema_absensi s ON jk.id_skema = s.id_skema WHERE jk.id_user = ? AND jk.tanggal = ?`;
        db.query(sql, [id_user, tanggal], callback);
    },

    getDailyWorkers: (tanggal, callback) => {
        const sql = `SELECT u.username, s.nama_skema, s.jam_masuk, s.jam_keluar FROM jadwal_karyawan jk JOIN users u ON jk.id_user = u.id_user JOIN skema_absensi s ON jk.id_skema = s.id_skema WHERE jk.tanggal = ? ORDER BY s.jam_masuk ASC`;
        db.query(sql, [tanggal], callback);
    },

    // [✓] FITUR HAPUS SHIFT DARI KALENDER
    deleteJadwal: (id_user, tanggal, callback) => {
        const sql = 'DELETE FROM jadwal_karyawan WHERE id_user = ? AND DATE(tanggal) = ?';
        db.query(sql, [id_user, tanggal], callback);
    },

    deleteJadwalBulk: (id_user, tanggalArray, callback) => {
        if (tanggalArray.length === 0) return callback(null, { affectedRows: 0 });
        const sql = 'DELETE FROM jadwal_karyawan WHERE id_user = ? AND DATE(tanggal) IN (?)';
        db.query(sql, [id_user, tanggalArray], callback);
    }
};

module.exports = Jadwal;