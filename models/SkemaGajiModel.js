const db = require("../config/db");

const SkemaGaji = {
    // 1. Ambil Semua Skema Gaji
    getAll: (callback) => {
        const sql = "SELECT * FROM skema_gaji ORDER BY gaji_bulanan DESC";
        db.query(sql, callback);
    },

    // 2. Ambil Skema Gaji by ID
    getById: (id, callback) => {
        const sql = "SELECT * FROM skema_gaji WHERE id_skemagaji = ?";
        db.query(sql, [id], callback);
    },

    // 3. Tambah Skema Gaji Baru
    create: (data, callback) => {
        const sql = `
            INSERT INTO skema_gaji (nama_golongan, gaji_bulanan, jam_kerja_per_hari, hari_kerja_per_bulan, rate_per_jam)
            VALUES (?, ?, ?, ?, ?)
        `;
        const values = [
            data.nama_golongan,
            data.gaji_bulanan,
            data.jam_kerja_per_hari || 9,
            data.hari_kerja_per_bulan || 22,
            data.rate_per_jam
        ];
        db.query(sql, values, callback);
    },

    // 4. Update Skema Gaji
    update: (id, data, callback) => {
        const sql = `
            UPDATE skema_gaji 
            SET nama_golongan = ?, gaji_bulanan = ?, jam_kerja_per_hari = ?, hari_kerja_per_bulan = ?, rate_per_jam = ?
            WHERE id_skemagaji = ?
        `;
        const values = [
            data.nama_golongan,
            data.gaji_bulanan,
            data.jam_kerja_per_hari,
            data.hari_kerja_per_bulan,
            data.rate_per_jam,
            id
        ];
        db.query(sql, values, callback);
    },

    // 5. Hapus Skema Gaji
    delete: (id, callback) => {
        const sql = "DELETE FROM skema_gaji WHERE id_skemagaji = ?";
        db.query(sql, [id], callback);
    }
};

module.exports = SkemaGaji;
