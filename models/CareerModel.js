const db = require('../config/db');

const CareerModel = {
    // Ambil data riwayat berdasarkan user yang login
    getByUserId: (id_user, callback) => {
        const query = `
            SELECT id_riwayat, id_user, nama_perusahaan, jabatan, 
                   DATE_FORMAT(tanggal_masuk, '%Y-%m-%d') as tanggal_masuk, 
                   DATE_FORMAT(tanggal_keluar, '%Y-%m-%d') as tanggal_keluar, 
                   foto_bukti, created_at 
            FROM riwayat_karier 
            WHERE id_user = ? 
            ORDER BY tanggal_masuk DESC
        `;
        db.query(query, [id_user], callback);
    },

    // Simpan riwayat baru
    create: (data, callback) => {
        const query = `
            INSERT INTO riwayat_karier 
            (id_user, nama_perusahaan, jabatan, tanggal_masuk, tanggal_keluar, foto_bukti) 
            VALUES (?, ?, ?, ?, ?, ?)
        `;
        const values = [
            data.id_user,
            data.nama_perusahaan,
            data.jabatan,
            data.tanggal_masuk,
            data.tanggal_keluar,
            data.foto_bukti
        ];
        db.query(query, values, callback);
    }
};

module.exports = CareerModel;