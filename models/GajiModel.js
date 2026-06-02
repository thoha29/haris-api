const db = require("../config/db");

class Gaji {
    // Fungsi untuk narik total waktu kerja dari tabel absensi
    static ambilDataLemburAbsensi(id_user, bulan, tahun, callback) {
        const sql = `
            SELECT 
                id_user,
                SUM(CASE WHEN status_hrd = 'approved' AND status != 'alpha' THEN 1 ELSE 0 END) as total_hari_masuk,
                SUM(CASE WHEN status = 'alpha' OR status_hrd = 'rejected' THEN 1 ELSE 0 END) as total_hari_alpha,
                SUM(CASE WHEN status_hrd = 'approved' THEN lembur ELSE 0 END) as total_jam_lembur,
                SUM(CASE WHEN status_hrd = 'approved' THEN keterlambatan ELSE 0 END) as total_menit_telat,
                SUM(CASE WHEN status_hrd = 'approved' THEN total_jam_kerja ELSE 0 END) as total_jam_kerja
            FROM absensi 
            WHERE id_user = ? 
              AND MONTH(tanggal) = ? 
              AND YEAR(tanggal) = ?
        `;
        db.query(sql, [id_user, bulan, tahun], callback);
    }

    static simpanSlipGaji(data, callback) {
        const sql = `INSERT INTO slip_gaji SET ?`;
        db.query(sql, data, callback);
    }

    static ambilDataSPPD(id_user, bulan, tahun, callback) {
        const sql = `
            SELECT SUM(total_hari) as total_hari_dinas
            FROM sppd 
            WHERE id_user = ? 
              AND MONTH(tanggal_mulai) = ? 
              AND YEAR(tanggal_mulai) = ?
              AND status_sppd = 'approved'
        `;
        db.query(sql, [id_user, bulan, tahun], callback);
    }

    // UPDATE: Ambil data gaji JOIN dengan data pribadi
    static getGajiByUser(id_user, callback) {
        const sql = `
            SELECT 
                h.*, 
                u.username,
                p.nik, 
                p.nama_lengkap, 
                p.nip, 
                p.status_karyawan, 
                p.jabatan
            FROM slip_gaji h 
            JOIN users u ON h.id_user = u.id_user 
            LEFT JOIN data_pribadi p ON h.id_user = p.id_user 
            WHERE h.id_user = ? 
            ORDER BY h.tahun DESC, h.bulan DESC
        `;
        db.query(sql, [id_user], callback);
    }

    // Untuk Pimpinan melihat seluruh gaji
    static getAllGaji(callback) {
        const sql = `
            SELECT 
                h.*, 
                u.username,
                p.nik, 
                p.nama_lengkap, 
                p.nip, 
                p.status_karyawan, 
                p.jabatan
            FROM slip_gaji h 
            JOIN users u ON h.id_user = u.id_user 
            LEFT JOIN data_pribadi p ON h.id_user = p.id_user 
            ORDER BY h.tahun DESC, h.bulan DESC
        `;
        db.query(sql, [], callback);
    }

    // Untuk Pimpinan mengubah status bayar
    static updateStatusGaji(id_slip, status_bayar, tanggal_dibayar, callback) {
        const sql = `UPDATE slip_gaji SET status_bayar = ?, tanggal_dibayar = ? WHERE id_slip = ?`;
        db.query(sql, [status_bayar, tanggal_dibayar, id_slip], callback);
    }
    // Untuk Pimpinan menghapus data gaji
    static deleteSlipGaji(id_slip, callback) {
        const sql = `DELETE FROM slip_gaji WHERE id_slip = ?`;
        db.query(sql, [id_slip], callback);
    }
}

module.exports = Gaji;