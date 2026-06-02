const db = require('../config/db'); // Pastikan path koneksi DB sudah benar

const DokumenPribadiModel = {
    // Fungsi untuk simpan data upload
    create: (data, callback) => {
        const sql = `INSERT INTO dokumen_pribadi 
                    (id_user, nama_dokumen, file_name, file_path, tipe_file) 
                    VALUES (?, ?, ?, ?, ?)`;

        const values = [
            data.id_user,
            data.nama_dokumen,
            data.file_name,
            data.file_path,
            data.tipe_file
        ];

        db.query(sql, values, callback);
    },

    // Fungsi untuk ambil daftar dokumen milik user (untuk tabel di JSX)
    getByUserId: (id_user, callback) => {
        const sql = `SELECT * FROM dokumen_pribadi WHERE id_user = ? ORDER BY uploaded_at DESC`;
        db.query(sql, [id_user], callback);
    },

    // BONUS: Fungsi hapus dokumen (biar HRIS kamu makin lengkap)
    deleteById: (id_dokumen, callback) => {
        const sql = `DELETE FROM dokumen_pribadi WHERE id_dokumen = ?`;
        db.query(sql, [id_dokumen], callback);
    }
};

module.exports = DokumenPribadiModel;