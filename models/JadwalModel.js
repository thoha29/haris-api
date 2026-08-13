const db = require("../config/db");

const Jadwal = {
    getKaryawanJadwal: (callback) => {
        const sql = `
            SELECT u.id_user, u.username, u.role, dp.tipe_kerja, dp.lokasi_kerja 
            FROM users u 
            LEFT JOIN data_pribadi dp ON u.id_user = dp.id_user 
            WHERE u.role IN ('karyawan', 'keuangan') 
            ORDER BY u.role ASC, u.username ASC
        `;
        db.query(sql, callback);
    },

    getUsersByRole: (role, callback) => {
        const sql = `SELECT id_user FROM users WHERE role = ?`;
        db.query(sql, [role], (err, results) => {
            if (err) return callback(err);
            const userIds = results.map(r => r.id_user);
            callback(null, userIds);
        });
    },

    assignJadwal: (id_user, id_skema, tanggal, callback) => {
        const sql = `INSERT INTO jadwal_karyawan (id_user, id_skema, tanggal) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE id_skema = VALUES(id_skema)`;
        db.query(sql, [id_user, id_skema, tanggal], callback);
    },

    assignJadwalBulk: (valuesArray, callback) => {
        if (!valuesArray || valuesArray.length === 0) {
            return callback(null, { affectedRows: 0 });
        }
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

    deleteJadwal: (id_user, tanggal, callback) => {
        const sql = 'DELETE FROM jadwal_karyawan WHERE id_user = ? AND DATE(tanggal) = ?';
        db.query(sql, [id_user, tanggal], callback);
    },

    deleteJadwalBulk: (userIds, tanggalArray, callback) => {
        const userList = Array.isArray(userIds) ? userIds : [userIds];
        const dateList = Array.isArray(tanggalArray) ? tanggalArray : [tanggalArray];
        if (userList.length === 0 || dateList.length === 0) {
            return callback(null, { affectedRows: 0 });
        }
        const sql = 'DELETE FROM jadwal_karyawan WHERE id_user IN (?) AND DATE(tanggal) IN (?)';
        db.query(sql, [userList, dateList], callback);
    }
};

module.exports = Jadwal;
