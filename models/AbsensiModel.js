const db = require("../config/db");

const Absensi = {
    // 1. Ambil Semua Data Absensi (HRD/Admin)
    getAll: (callback) => {
        const sql = `
            SELECT a.*, u.username, u.role, s.nama_skema 
            FROM absensi a 
            JOIN users u ON a.id_user = u.id_user 
            LEFT JOIN skema_absensi s ON a.id_skema = s.id_skema
            ORDER BY a.tanggal DESC, a.jam_masuk DESC
        `;
        db.query(sql, callback);
    },

    // 2. Cek apakah user sudah absen hari ini
    checkTodayAttendance: (id_user, tanggal, callback) => {
        const sql = `
            SELECT * FROM absensi 
            WHERE id_user = ? AND tanggal = ?
        `;
        db.query(sql, [id_user, tanggal], callback);
    },

    // 3. Proses Check-In (Sesuai dengan skema tabel payroll)
    checkIn: (data, callback) => {
        const finalStatusUser = 'pending';
        const finalStatusHRD = 'pending';
        
        const isApprovedFinal = 'pending';

        const sql = `
            INSERT INTO absensi (id_user, id_skema, tanggal, jam_masuk, keterlambatan, is_approved, status_user, status_hrd) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `;
        const values = [
            data.id_user,
            data.id_skema,
            data.tanggal,
            data.jam_masuk,
            data.keterlambatan || 0,
            isApprovedFinal,
            finalStatusUser,
            finalStatusHRD
        ];
        db.query(sql, values, callback);
    },

    // 4. Update Check-Out
    checkOut: (id_user, tanggal, jam_keluar, lembur, total_jam_kerja, callback) => {
        const sql = `
            UPDATE absensi 
            SET jam_keluar = ?, lembur = ?, total_jam_kerja = ?
            WHERE id_user = ? AND tanggal = ? AND jam_keluar IS NULL
            ORDER BY id_data_absensi DESC LIMIT 1
        `;
        db.query(sql, [jam_keluar, lembur, total_jam_kerja, id_user, tanggal], callback);
    },

    // --- LOGIKA APPROVAL BERJENJANG ---

    // 5. Update Status Tahap 1 (Atasan)
updateStatusUser: (id_data_absensi, status, callback) => {

    const sql = `
        UPDATE absensi
        SET status_user = ?,
            status_hrd = ?,
            is_approved = ?
        WHERE id_data_absensi = ?
    `;

    db.query(
        sql,
        [status, status, status, id_data_absensi],
        callback
    );
},
    // 6. Update Status Tahap 2 (HRD - Keputusan Final)
    // updated_at akan otomatis terisi current_timestamp oleh MySQL saat query ini jalan


    // 7. List Approval User
    getPendingForUser: (callback) => {
        const sql = `
            SELECT a.*, u.username AS nama, u.role, s.nama_skema 
            FROM absensi a 
            JOIN users u ON a.id_user = u.id_user 
            LEFT JOIN skema_absensi s ON a.id_skema = s.id_skema
            WHERE a.status_user = 'pending'
            ORDER BY a.tanggal DESC, a.jam_masuk DESC
        `;
        db.query(sql, callback);
    },

    // 8. List Approval HRD (Role HRD di-filter agar tidak muncul)


    // Ambil riwayat termasuk updated_at untuk melihat waktu eksekusi HRD
    getByUserId: (id_user, callback) => {
        const sql = `
            SELECT a.*, s.nama_skema, u.role, u.username 
            FROM absensi a
            JOIN users u ON a.id_user = u.id_user 
            LEFT JOIN skema_absensi s ON a.id_skema = s.id_skema
            WHERE a.id_user = ? 
            ORDER BY a.tanggal DESC LIMIT 30
        `;
        db.query(sql, [id_user], callback);
    },

    getAllEmployees: (callback) => {
        const sql = `
            SELECT id_user, username, role 
            FROM users 
            WHERE role IN ('karyawan', 'user', 'keuangan') 
            ORDER BY username ASC
        `;
        db.query(sql, callback);
    },

    // Method baru untuk edit absensi khusus HRD
    updateAbsensiByHRD: (id_data_absensi, data, callback) => {
        const sql = `
            UPDATE absensi 
            SET jam_masuk = ?, 
                jam_keluar = ?, 
                total_jam_kerja = ?, 
                keterlambatan = ?, 
                lembur = ?, 
                status = ?, 
                status_hrd = ?, 
                is_approved = ?
            WHERE id_data_absensi = ?
        `;
        const values = [
            data.jam_masuk,
            data.jam_keluar,
            data.total_jam_kerja,
            data.keterlambatan,
            data.lembur,
            data.status,
            data.status_hrd,
            data.is_approved,
            id_data_absensi
        ];
        db.query(sql, values, callback);
    }
};

module.exports = Absensi;
