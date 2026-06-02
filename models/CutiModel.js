const db = require("../config/db");

const Cuti = {
    // 1. Karyawan mengajukan cuti (Default status, status_user & status_hrd = 'pending')
    create: (data, callback) => {
        const sql = `
            INSERT INTO cuti (id_user, tipe, tanggal_mulai, tanggal_selesai, alasan, status, status_user, status_hrd) 
            VALUES (?, ?, ?, ?, ?, 'pending', 'pending', 'pending')
        `;
        db.query(sql, [data.id_user, data.tipe, data.tanggal_mulai, data.tanggal_selesai, data.alasan], callback);
    },

    // 2. Karyawan melihat riwayat cuti pribadi
    getByUserId: (id_user, callback) => {
        const sql = `
            SELECT id_cuti, tipe, tanggal_mulai, tanggal_selesai, alasan, 
                   status, status_user, status_hrd, created_at 
            FROM cuti 
            WHERE id_user = ? 
            ORDER BY created_at DESC
        `;
        db.query(sql, [id_user], callback);
    },

    // 3. TAHAP 1: Update Approval oleh User / Atasan
    updateStatusUser: (id_cuti, status, callback) => {
        // Jika Atasan REJECT, maka hasil FINAL (status) juga REJECTED.
        const statusFinal = (status === 'rejected') ? 'rejected' : 'pending';
        const sql = "UPDATE cuti SET status_user = ?, status = ? WHERE id_cuti = ?";
        db.query(sql, [status, statusFinal, id_cuti], callback);
    },

    // 4. TAHAP 2: Update Approval Final oleh HRD + Sinkronkan ke Kolom Status
    updateStatusHRD: (id_cuti, status, callback) => {
        const infoSql = `
            SELECT id_user, tipe, (DATEDIFF(tanggal_selesai, tanggal_mulai) + 1) AS durasi 
            FROM cuti WHERE id_cuti = ?`;

        db.query(infoSql, [id_cuti], (err, results) => {
            if (err) return callback(err);
            if (results.length === 0) return callback(new Error("Data tidak ditemukan"));

            const { id_user, tipe, durasi } = results[0];

            // UPDATE: status_hrd DAN status (hasil final) disamakan agar sinkron di database
            const updateSql = "UPDATE cuti SET status_hrd = ?, status = ? WHERE id_cuti = ?";
            db.query(updateSql, [status, status, id_cuti], (err) => {
                if (err) return callback(err);

                // POTONG JATAH: Cuma jika status 'approved' DAN tipe 'Cuti' (Tahunan)
                if (status === 'approved' && tipe === 'Cuti') {
                    const userUpdateSql = "UPDATE users SET jatah_cuti = jatah_cuti - ? WHERE id_user = ?";
                    db.query(userUpdateSql, [durasi, id_user], callback);
                } else {
                    callback(null);
                }
            });
        });
    },

    // 5. Monitoring Atasan
    getAllForUser: (callback) => {
        const sql = `
            SELECT cuti.*, users.username AS nama_karyawan 
            FROM cuti 
            JOIN users ON cuti.id_user = users.id_user 
            WHERE cuti.status_user = 'pending'
            ORDER BY cuti.created_at DESC`;
        db.query(sql, callback);
    },

    // 6. Monitoring HRD
    getAllForHRD: (callback) => {
        const sql = `
            SELECT cuti.*, users.username AS nama_karyawan 
            FROM cuti 
            JOIN users ON cuti.id_user = users.id_user 
            WHERE cuti.status_user = 'approved' AND cuti.status_hrd = 'pending'
            ORDER BY cuti.created_at DESC`;
        db.query(sql, callback);
    },

    // 7. Ambil semua data global (Laporan)
    getAll: (callback) => {
        const sql = `
            SELECT cuti.*, users.username AS nama_karyawan 
            FROM cuti 
            JOIN users ON cuti.id_user = users.id_user 
            ORDER BY cuti.created_at DESC`;
        db.query(sql, callback);
    },

    // 8. Cek Sisa Cuti (SINKRON: Total, Terpakai, Sisa)
    getSisaCuti: (id_user, callback) => {
        const sql = `
            SELECT 
                u.jatah_cuti AS sisa_saat_ini,
                (SELECT COALESCE(SUM(DATEDIFF(tanggal_selesai, tanggal_mulai) + 1), 0) 
                 FROM cuti 
                 WHERE id_user = u.id_user 
                   AND status_hrd = 'approved' 
                   AND tipe = 'Cuti') AS cuti_tahunan_terpakai
            FROM users u
            WHERE u.id_user = ?
        `;
        db.query(sql, [id_user], (err, results) => {
            if (err) return callback(err);
            if (results.length === 0) return callback(null, { total_jatah: 0, terpakai: 0, sisa_cuti: 0 });

            const { sisa_saat_ini } = results[0];

            // Asumsi jatah tahunan dasar dari perusahaan adalah 12 hari
            const baseJatahTahunan = 12;
            const terpakai = baseJatahTahunan - sisa_saat_ini;

            callback(null, {
                // Sisa adalah kolom jatah_cuti di DB (sisa murni yang belum diajukan)
                sisa_cuti: sisa_saat_ini,
                // Terpakai adalah jatah awal dikurangi sisa saat ini
                terpakai: terpakai > 0 ? terpakai : 0,
                // Total Jatah yang ditampilkan selalu statis 12 (karena user set 12 di DB defaultnya)
                total_jatah: baseJatahTahunan
            });
        });
    }
};

module.exports = Cuti;