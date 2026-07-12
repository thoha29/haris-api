const db = require('../config/db');

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
        INSERT INTO absensi (
            id_user,
            id_skema,
            tanggal,
            jam_masuk,
            keterlambatan,
            lokasi_absensi,
            latitude,
            longitude,
            is_approved,
            status_user,
            status_hrd
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    const values = [
      data.id_user,
      data.id_skema,
      data.tanggal,
      data.jam_masuk,
      data.keterlambatan || 0,

      data.lokasi_absensi || null,
      data.latitude || null,
      data.longitude || null,

      isApprovedFinal,
      finalStatusUser,
      finalStatusHRD,
    ];

    db.query(sql, values, callback);
  },

  // 4. Update Check-Out
  checkOut: (
    id_user,
    jam_keluar,
    lembur,
    total_jam_kerja,
    tanggal_keluar,
    callback
  ) => {
    const sql = `
      UPDATE absensi 
      SET jam_keluar = ?, lembur = ?, total_jam_kerja = ?, tanggal_keluar = ?
      WHERE id_user = ? AND jam_keluar IS NULL
      ORDER BY id_data_absensi DESC LIMIT 1
    `;

    db.query(
      sql,
      [jam_keluar, lembur, total_jam_kerja, tanggal_keluar, id_user],
      callback
    );
  },

  // --- LOGIKA APPROVAL BERJENJANG ---

  // 5. Update Status Tahap 1 (Atasan)
  updateStatusUser: (id_data_absensi, status, callback) => {
    let sql;
    let values;

    if (status === 'approved') {
      sql = `
            UPDATE absensi
            SET status_user = 'approved',
                status_hrd = 'approved',
                is_approved = 'approved'
            WHERE id_data_absensi = ?
        `;

      values = [id_data_absensi];
    } else {
      sql = `
            UPDATE absensi
            SET status_user = 'rejected',
                status_hrd = 'rejected',
                is_approved = 'rejected'
            WHERE id_data_absensi = ?
        `;

      values = [id_data_absensi];
    }

    db.query(sql, values, callback);
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
  getPendingForHRD: (callback) => {
    const sql = `
        SELECT a.*, u.username AS nama, u.role, s.nama_skema
        FROM absensi a
        JOIN users u ON a.id_user = u.id_user
        LEFT JOIN skema_absensi s ON a.id_skema = s.id_skema
        WHERE a.status_user = 'pending'
              AND u.role != 'hrd'
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
      id_data_absensi,
    ];
    db.query(sql, values, callback);
  },

  replaceAllProses: (tanggal, tanggal_keluar, id_user, callback) => {
    db.getConnection((err, conn) => {
      if (err) return callback(err);

      conn.beginTransaction(async (err) => {
        if (err) {
          conn.release();
          return callback(err);
        }

        try {
          // =========================
          // 1. ABSENSI
          // =========================
          await conn.promise().query(
            `DELETE FROM absensi_proses
             WHERE id_user = ?`,
            [id_user]
          );

          await conn.promise().query(
            `INSERT INTO absensi_proses
             SELECT * FROM absensi
             WHERE tanggal >= ? AND tanggal_keluar <= ? AND id_user = ?`,
            [tanggal, tanggal_keluar, id_user]
          );

          // =========================
          // 2. LEMBUR
          // =========================
          await conn.promise().query(
            `DELETE FROM absensi_lembur_proses
             WHERE id_user = ?`,
            [id_user]
          );

          await conn.promise().query(
            `INSERT INTO absensi_lembur_proses
             SELECT * FROM absensi_lembur
             WHERE tanggal >= ? AND tanggal_keluar <= ? AND id_user = ?`,
            [tanggal, tanggal_keluar, id_user]
          );

          // =========================
          // 3. JADWAL KARYAWAN
          // =========================
          await conn.promise().query(
            `DELETE FROM jadwal_karyawan_proses
             WHERE id_user = ?`,
            [tanggal, tanggal_keluar, id_user]
          );

          await conn.promise().query(
            `INSERT INTO jadwal_karyawan_proses
             SELECT * FROM jadwal_karyawan
             WHERE tanggal >= ? AND tanggal <= ? AND id_user = ?`,
            [tanggal, tanggal_keluar, id_user]
          );

          // =========================
          // COMMIT
          // =========================
          await conn.promise().commit();
          conn.release();

          callback(null, { message: 'Semua proses berhasil' });
        } catch (error) {
          await conn.promise().rollback();
          conn.release();
          callback(error);
        }
      });
    });
  },
};

module.exports = Absensi;
