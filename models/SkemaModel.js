const db = require("../config/db");

const Skema = {
    // Ambil semua daftar skema
    getAll: (callback) => {
        db.query("SELECT * FROM skema_absensi", callback);
    },

    // Ambil detail satu skema
    getById: (id, callback) => {
        db.query("SELECT * FROM skema_absensi WHERE id_skema = ?", [id], callback);
    },

    // HRD Tambah Skema Baru
    create: (data, callback) => {
        const sql = `INSERT INTO skema_absensi (nama_skema, jam_masuk, jam_keluar, toleransi_menit) 
                     VALUES (?, ?, ?, ?)`;
        db.query(sql, [data.nama_skema, data.jam_masuk, data.jam_keluar, data.toleransi_menit], callback);
    },

    // HRD Update Skema
    update: (id, data, callback) => {
        const sql = `UPDATE skema_absensi SET nama_skema=?, jam_masuk=?, jam_keluar=?, toleransi_menit=? 
                     WHERE id_skema=?`;
        db.query(sql, [data.nama_skema, data.jam_masuk, data.jam_keluar, data.toleransi_menit, id], callback);
    },

    // HRD Hapus Skema
    delete: (id, callback) => {
        db.query("DELETE FROM skema_absensi WHERE id_skema = ?", [id], callback);
    }
};

module.exports = Skema;