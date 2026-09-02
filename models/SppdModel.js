const db = require('../config/db');

const SppdModel = {
  create: (data, callback) => {
    const sql = `
      INSERT INTO sppd (
        id_user,
        id_creator,
        nomor_sppd,
        alamat_tujuan,
        tugas,
        transportasi_perusahaan,
        transportasi_umum,
        tanggal_mulai,
        tanggal_selesai,
        tempat_tinggal,
        konsumsi,
        barang_bawaan_pt,
        satuan_barang_pt,
        barang_bawaan_karyawan,
        satuan_barang_karyawan,
        ditujuan_melapor_kepada,
        total_hari,
        status_sppd,
        keterangan,
        status_atasan,
        status_hrd
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, 'pending', 'pending')
    `;

    const values = [
      data.id_user,
      data.id_creator || null,
      data.nomor_sppd,
      data.alamat_tujuan,
      data.tugas || null,
      data.transportasi_perusahaan || null,
      data.transportasi_umum || null,
      data.tanggal_mulai,
      data.tanggal_selesai,
      data.tempat_tinggal,
      data.konsumsi,
      data.barang_bawaan_pt || null,
      data.satuan_barang_pt || null,
      data.barang_bawaan_karyawan || null,
      data.satuan_barang_karyawan || null,
      data.ditujuan_melapor_kepada || 'Atasan',
      data.total_hari || 1,
      data.keterangan || null,
    ];

    db.query(sql, values, callback);
  },

  getAll: (filter = {}, callback) => {
    let sql = `
      SELECT 
        s.*,
        u.username AS nama_karyawan,
        u.role AS role_karyawan,
        dp.tipe_kerja,
        dp.lokasi_kerja,
        c.username AS nama_pembuat,
        tp.nama_transportasi,
        tp.no_transportasi,
        r.id AS id_rab,
        r.status AS status_rab,
        r.perubahan AS status_perubahan_rab,
        r.catatan_hrd,
        r.catatan_atasan
      FROM sppd s
      JOIN users u ON s.id_user = u.id_user
      LEFT JOIN data_pribadi dp ON u.id_user = dp.id_user
      LEFT JOIN users c ON s.id_creator = c.id_user
      LEFT JOIN transportasi_perusahaan tp ON s.transportasi_perusahaan = tp.id
      LEFT JOIN rab r ON s.id_sppd = r.id_sppd
      WHERE 1=1
    `;

    const params = [];

    if (filter.id_user) {
      sql += ` AND s.id_user = ?`;
      params.push(filter.id_user);
    }

    if (filter.id_creator) {
      sql += ` AND s.id_creator = ?`;
      params.push(filter.id_creator);
    }

    if (filter.status_sppd) {
      sql += ` AND s.status_sppd = ?`;
      params.push(filter.status_sppd);
    }

    if (filter.status_hrd) {
      sql += ` AND s.status_hrd = ?`;
      params.push(filter.status_hrd);
    }

    sql += ` ORDER BY s.id_sppd DESC`;

    db.query(sql, params, callback);
  },

  getById: (id_sppd, callback) => {
    const sql = `
      SELECT 
        s.*,
        u.username AS nama_karyawan,
        u.role AS role_karyawan,
        dp.tipe_kerja,
        dp.lokasi_kerja,
        c.username AS nama_pembuat,
        tp.nama_transportasi,
        tp.no_transportasi,
        r.id AS id_rab,
        r.status AS status_rab,
        r.perubahan AS status_perubahan_rab,
        r.alasan_perubahan,
        r.catatan_hrd,
        r.catatan_atasan
      FROM sppd s
      JOIN users u ON s.id_user = u.id_user
      LEFT JOIN data_pribadi dp ON u.id_user = dp.id_user
      LEFT JOIN users c ON s.id_creator = c.id_user
      LEFT JOIN transportasi_perusahaan tp ON s.transportasi_perusahaan = tp.id
      LEFT JOIN rab r ON s.id_sppd = r.id_sppd
      WHERE s.id_sppd = ?
    `;

    db.query(sql, [id_sppd], (err, results) => {
      if (err) return callback(err);
      if (results.length === 0) return callback(null, null);

      const sppd = results[0];

      if (!sppd.id_rab) {
        return callback(null, sppd);
      }

      // Fetch RAB Details
      const sqlRabDetails = `
        SELECT 
          rd.*,
          DATE_FORMAT(rd.tanggal, '%Y-%m-%d') AS tanggal,
          m.nama_komponen,
          m.kategori,
          m.satuan
        FROM rab_detail rd
        JOIN master_komponen_rab m ON rd.id_komponen = m.id
        WHERE rd.id_rab = ?
        ORDER BY rd.tanggal ASC, rd.tipe_komponen ASC, rd.id ASC
      `;

      db.query(sqlRabDetails, [sppd.id_rab], (err2, details) => {
        if (err2) return callback(err2);
        sppd.rab_details = details;
        callback(null, sppd);
      });
    });
  },

  // ─── APPROVAL OLEH ATASAN (USER) ─────────────────────────────────────────
  approveByAtasan: (id_sppd, status, catatan, callback) => {
    if (status === 'rejected' && (!catatan || !catatan.trim())) {
      return callback(new Error('Alasan penolakan wajib diisi!'));
    }

    if (status === 'approved') {
      // Setuju SPPD → status menjadi approved_atasan, menunggu review RAB
      const sql = `UPDATE sppd SET status_sppd = 'approved_atasan', status_atasan = 'approved' WHERE id_sppd = ?`;
      db.query(sql, [id_sppd], (err, res) => {
        if (err) return callback(err);
        callback(null, res);
      });
    } else {
      // Tolak SPPD → SPPD dan RAB keduanya rejected (hanya valid saat pending_atasan)
      const sql = `UPDATE sppd SET status_sppd = 'rejected', status_atasan = 'rejected', catatan_atasan = ? WHERE id_sppd = ?`;
      db.query(sql, [catatan || null, id_sppd], (err, res) => {
        if (err) return callback(err);
        // Auto-reject RAB
        db.query(`UPDATE rab SET status = 'rejected', catatan_atasan = ? WHERE id_sppd = ?`, [catatan || null, id_sppd], () => { });
        callback(null, res);
      });
    }
  },

  // ─── PEMBATALAN OLEH ATASAN (jika SPPD sudah approved_atasan atau lebih) ───
  cancelByAtasan: (id_sppd, callback) => {
    db.query(`SELECT * FROM sppd WHERE id_sppd = ?`, [id_sppd], (err, sppdRows) => {
      if (err) return callback(err);
      if (sppdRows.length === 0) return callback(new Error('SPPD tidak ditemukan!'));

      const sppd = sppdRows[0];
      const validStatuses = ['approved_atasan', 'approved', 'active'];
      if (!validStatuses.includes(sppd.status_sppd)) {
        return callback(new Error('SPPD hanya dapat dibatalkan jika sudah disetujui atasan.'));
      }

      db.query(`UPDATE sppd SET status_sppd = 'cancelled', pembatalan = 'approved' WHERE id_sppd = ?`, [id_sppd], (err2, res) => {
        if (err2) return callback(err2);

        db.query(`UPDATE rab SET status = 'cancelled' WHERE id_sppd = ?`, [id_sppd], () => { });

        if (sppd.transportasi_perusahaan) {
          db.query(`UPDATE transportasi_perusahaan SET status = 'available' WHERE id = ?`, [sppd.transportasi_perusahaan]);
        }

        // Hapus jadwal untuk tanggal SPPD (jangan di-assign ke skema manapun)
        const startStr = typeof sppd.tanggal_mulai === 'string' ? sppd.tanggal_mulai : new Date(sppd.tanggal_mulai).toISOString().split('T')[0];
        const endStr = typeof sppd.tanggal_selesai === 'string' ? sppd.tanggal_selesai : new Date(sppd.tanggal_selesai).toISOString().split('T')[0];

        db.query(`DELETE FROM jadwal_karyawan WHERE id_user = ? AND DATE(tanggal) BETWEEN ? AND ?`, [sppd.id_user, startStr, endStr], () => {
          callback(null, res);
        });
      });
    });
  },

  approveByHrd: (id_sppd, status, catatan_hrd, callback) => {
    if (status === 'rejected' && (!catatan_hrd || !catatan_hrd.trim())) {
      return callback(new Error('Alasan penolakan wajib diisi oleh HRD!'));
    }

    if (status === 'approved') {
      const sql = `UPDATE sppd SET status_hrd = 'approved', status_sppd = 'approved' WHERE id_sppd = ?`;
      db.query(sql, [id_sppd], (err, res) => {
        if (err) return callback(err);

        // Update RAB status to approved
        db.query(`UPDATE rab SET status = 'approved', catatan_hrd = ? WHERE id_sppd = ?`, [catatan_hrd || null, id_sppd], (errRab) => {
          if (errRab) console.error('Error updating rab status:', errRab);

          // Get SPPD details to set vehicle and schedule
          const sqlGetSppd = `
            SELECT 
              id_sppd,
              id_user,
              transportasi_perusahaan,
              DATE_FORMAT(tanggal_mulai, '%Y-%m-%d') AS tanggal_mulai,
              DATE_FORMAT(tanggal_selesai, '%Y-%m-%d') AS tanggal_selesai
            FROM sppd 
            WHERE id_sppd = ?
          `;
          db.query(sqlGetSppd, [id_sppd], (err2, sppdRows) => {
            if (err2 || sppdRows.length === 0) return callback(null, res);
            const sppd = sppdRows[0];

            if (sppd.transportasi_perusahaan) {
              db.query(`UPDATE transportasi_perusahaan SET status = 'occupied' WHERE id = ?`, [sppd.transportasi_perusahaan]);
            }

            db.query(`SELECT id_skema FROM pengaturan_skema WHERE key_setting = 'skema_dinas'`, (err3, settingRows) => {
              const idSkemaDinas = settingRows && settingRows.length > 0 ? settingRows[0].id_skema : 11;

              const dates = [];
              if (sppd.tanggal_mulai && sppd.tanggal_selesai) {
                const [sY, sM, sD] = sppd.tanggal_mulai.split('-').map(Number);
                const [eY, eM, eD] = sppd.tanggal_selesai.split('-').map(Number);
                const curDate = new Date(sY, sM - 1, sD);
                const endDate = new Date(eY, eM - 1, eD);

                while (curDate <= endDate) {
                  const y = curDate.getFullYear();
                  const m = String(curDate.getMonth() + 1).padStart(2, '0');
                  const d = String(curDate.getDate()).padStart(2, '0');
                  dates.push(`${y}-${m}-${d}`);
                  curDate.setDate(curDate.getDate() + 1);
                }
              }

              if (dates.length > 0) {
                const values = dates.map((d) => [sppd.id_user, idSkemaDinas, d]);
                const sqlJadwal = `
                  INSERT INTO jadwal_karyawan (id_user, id_skema, tanggal) 
                  VALUES ? 
                  ON DUPLICATE KEY UPDATE id_skema = VALUES(id_skema)
                `;
                db.query(sqlJadwal, [values], (errJ) => {
                  if (errJ) console.error('[SppdModel] Error updating jadwal to Dinas:', errJ);
                  callback(null, res);
                });
              } else {
                callback(null, res);
              }
            });
          });
        });
      });
    } else {
      // Rejected
      const sql = `UPDATE sppd SET status_hrd = 'rejected', status_sppd = 'rejected' WHERE id_sppd = ?`;
      db.query(sql, [id_sppd], (err, res) => {
        if (err) return callback(err);

        db.query(`UPDATE rab SET status = 'rejected_hrd', catatan_hrd = ? WHERE id_sppd = ?`, [catatan_hrd, id_sppd], () => {
          callback(null, res);
        });
      });
    }
  },

  requestCancel: (id_sppd, id_user, alasan_batal, callback) => {
    let sql = `
      UPDATE sppd 
      SET pembatalan = 'pending_hrd', alasan_batal = ?
      WHERE id_sppd = ?
    `;
    let params = [alasan_batal, id_sppd];
    if (id_user) {
      sql += ` AND id_user = ?`;
      params.push(id_user);
    }
    db.query(sql, params, callback);
  },

  approveCancelHrd: (id_sppd, status, callback) => {
    let sql;
    if (status === 'approved') {
      sql = `UPDATE sppd SET pembatalan = 'pending_atasan' WHERE id_sppd = ?`;
    } else {
      sql = `UPDATE sppd SET pembatalan = 'rejected' WHERE id_sppd = ?`;
    }
    db.query(sql, [id_sppd], callback);
  },

  approveCancelAtasan: (id_sppd, status, callback) => {
    if (status === 'approved') {
      const sql = `UPDATE sppd SET pembatalan = 'approved', status_sppd = 'cancelled' WHERE id_sppd = ?`;
      db.query(sql, [id_sppd], (err, res) => {
        if (err) return callback(err);

        db.query(`SELECT * FROM sppd WHERE id_sppd = ?`, [id_sppd], (err2, sppdRows) => {
          if (err2 || sppdRows.length === 0) return callback(null, res);
          const sppd = sppdRows[0];

          if (sppd.transportasi_perusahaan) {
            db.query(`UPDATE transportasi_perusahaan SET status = 'available' WHERE id = ?`, [sppd.transportasi_perusahaan]);
          }

          // Hapus jadwal untuk tanggal SPPD (jangan di-assign ke skema manapun)
          const startStr = typeof sppd.tanggal_mulai === 'string' ? sppd.tanggal_mulai : new Date(sppd.tanggal_mulai).toISOString().split('T')[0];
          const endStr = typeof sppd.tanggal_selesai === 'string' ? sppd.tanggal_selesai : new Date(sppd.tanggal_selesai).toISOString().split('T')[0];

          db.query(`DELETE FROM jadwal_karyawan WHERE id_user = ? AND DATE(tanggal) BETWEEN ? AND ?`, [sppd.id_user, startStr, endStr], () => {
            callback(null, res);
          });
        });
      });
    } else {
      const sql = `UPDATE sppd SET pembatalan = 'rejected' WHERE id_sppd = ?`;
      db.query(sql, [id_sppd], callback);
    }
  },
};

module.exports = SppdModel;
