const db = require('../config/db');

const RabModel = {
  getRabBySppdId: (id_sppd, callback) => {
    const sqlRab = `
      SELECT 
        r.*,
        s.nomor_sppd,
        s.alamat_tujuan,
        s.tugas,
        DATE_FORMAT(s.tanggal_mulai, '%Y-%m-%d') AS tanggal_mulai,
        DATE_FORMAT(s.tanggal_selesai, '%Y-%m-%d') AS tanggal_selesai,
        s.total_hari,
        s.status_sppd,
        s.status_hrd,
        s.id_user,
        u.username AS nama_karyawan,
        c.username AS nama_pembuat
      FROM rab r
      JOIN sppd s ON r.id_sppd = s.id_sppd
      JOIN users u ON s.id_user = u.id_user
      LEFT JOIN users c ON s.id_creator = c.id_user
      WHERE r.id_sppd = ?
    `;

    db.query(sqlRab, [id_sppd], (err, rabResults) => {
      if (err) return callback(err);
      if (rabResults.length === 0) return callback(null, null);

      const rab = rabResults[0];

      const sqlDetails = `
        SELECT 
          rd.id,
          rd.id_rab,
          rd.id_komponen,
          DATE_FORMAT(rd.tanggal, '%Y-%m-%d') AS tanggal,
          rd.tipe_komponen,
          rd.jumlah,
          rd.harga_satuan,
          rd.total,
          rd.jumlah_hrd,
          rd.harga_satuan_hrd,
          rd.total_hrd,
          rd.keterangan,
          m.nama_komponen,
          m.kategori,
          m.satuan,
          m.tipe_komponen AS master_tipe_komponen
        FROM rab_detail rd
        JOIN master_komponen_rab m ON rd.id_komponen = m.id
        WHERE rd.id_rab = ?
        ORDER BY rd.tanggal ASC, rd.tipe_komponen ASC, rd.id ASC
      `;

      db.query(sqlDetails, [rab.id], (err2, details) => {
        if (err2) return callback(err2);
        rab.details = details || [];

        // Calculate summary per component across all days
        const summaryMap = {};
        let grandTotalAtasan = 0;
        let grandTotalHrd = 0;

        (details || []).forEach((d) => {
          const compId = d.id_komponen;
          if (!summaryMap[compId]) {
            summaryMap[compId] = {
              id_komponen: compId,
              nama_komponen: d.nama_komponen,
              kategori: d.kategori,
              satuan: d.satuan,
              tipe_komponen: d.tipe_komponen,
              total_jumlah_atasan: 0,
              total_biaya_atasan: 0,
              total_jumlah_hrd: 0,
              total_biaya_hrd: 0,
              selisih_biaya: 0,
            };
          }

          const qAtasan = Number(d.jumlah) || 0;
          const bAtasan = parseFloat(d.total) || (qAtasan * (parseFloat(d.harga_satuan) || 0));
          const qHrd = d.jumlah_hrd !== null && d.jumlah_hrd !== undefined ? Number(d.jumlah_hrd) : qAtasan;
          const bHrd = d.total_hrd !== null && d.total_hrd !== undefined ? parseFloat(d.total_hrd) : (qHrd * (parseFloat(d.harga_satuan_hrd || d.harga_satuan) || 0));

          summaryMap[compId].total_jumlah_atasan += qAtasan;
          summaryMap[compId].total_biaya_atasan += bAtasan;
          summaryMap[compId].total_jumlah_hrd += qHrd;
          summaryMap[compId].total_biaya_hrd += bHrd;
          summaryMap[compId].selisih_biaya = summaryMap[compId].total_biaya_hrd - summaryMap[compId].total_biaya_atasan;

          grandTotalAtasan += bAtasan;
          grandTotalHrd += bHrd;
        });

        rab.summary_per_komponen = Object.values(summaryMap);
        rab.grand_total_atasan = grandTotalAtasan;
        rab.grand_total_hrd = grandTotalHrd;
        rab.selisih_grand_total = grandTotalHrd - grandTotalAtasan;

        // Check if HRD can edit (today <= tanggal_selesai)
        const todayStr = new Date().toISOString().split('T')[0];
        const endStr = rab.tanggal_selesai || '';
        rab.can_edit_hrd = endStr ? (todayStr <= endStr) : true;

        callback(null, rab);
      });
    });
  },

  submitRab: (id_sppd, detailsArray, callback) => {
    // 1. Verify SPPD exists
    db.query(`SELECT * FROM sppd WHERE id_sppd = ?`, [id_sppd], (err, sppdRows) => {
      if (err) return callback(err);
      if (sppdRows.length === 0) return callback(new Error('SPPD tidak ditemukan!'));

      // 2. Insert or update RAB record (status: pending_hrd)
      const sppd = sppdRows[0];
      let firstDay = null;
      if (sppd.tanggal_mulai) {
        if (typeof sppd.tanggal_mulai === 'object' && sppd.tanggal_mulai instanceof Date) {
          const y = sppd.tanggal_mulai.getFullYear();
          const m = String(sppd.tanggal_mulai.getMonth() + 1).padStart(2, '0');
          const d = String(sppd.tanggal_mulai.getDate()).padStart(2, '0');
          firstDay = `${y}-${m}-${d}`;
        } else {
          firstDay = sppd.tanggal_mulai.toString().split('T')[0].split(' ')[0];
        }
      }

      const sqlRab = `
        INSERT INTO rab (id_sppd, status, perubahan)
        VALUES (?, 'pending_hrd', 'none')
        ON DUPLICATE KEY UPDATE status = 'pending_hrd', perubahan = 'none', updatedAt = CURRENT_TIMESTAMP
      `;

      db.query(sqlRab, [id_sppd], (err2) => {
        if (err2) return callback(err2);

        // Get RAB ID
        db.query(`SELECT id FROM rab WHERE id_sppd = ?`, [id_sppd], (err3, rabRows) => {
          if (err3 || rabRows.length === 0) return callback(err3 || new Error('Gagal mengambil ID RAB'));
          const id_rab = rabRows[0].id;

          // Delete existing details
          db.query(`DELETE FROM rab_detail WHERE id_rab = ?`, [id_rab], (err4) => {
            if (err4) return callback(err4);

            if (!detailsArray || detailsArray.length === 0) {
              return callback(null, { message: 'RAB berhasil disimpan tanpa rincian item', id_rab });
            }

            const detailValues = detailsArray.map((item) => {
              const jumlah = Number(item.jumlah) || 1;
              const hargaSatuan = parseFloat(item.harga_satuan) || 0;
              const total = parseFloat(item.total) || (jumlah * hargaSatuan);
              const tipeKomponen = item.tipe_komponen || 'harian';
              let tanggal = item.tanggal ? item.tanggal : null;
              if (tipeKomponen === 'sekali' && (!tanggal || tanggal === 'null' || tanggal === 'undefined')) {
                tanggal = firstDay;
              }
              const keterangan = item.keterangan || null;

              // Initial values for HRD match the initial atasan submission
              const jumlahHrd = jumlah;
              const hargaSatuanHrd = hargaSatuan;
              const totalHrd = total;

              return [
                id_rab,
                item.id_komponen,
                tanggal,
                tipeKomponen,
                jumlah,
                hargaSatuan,
                total,
                jumlahHrd,
                hargaSatuanHrd,
                totalHrd,
                keterangan,
              ];
            });

            const sqlInsertDetails = `
              INSERT INTO rab_detail (
                id_rab, id_komponen, tanggal, tipe_komponen,
                jumlah, harga_satuan, total,
                jumlah_hrd, harga_satuan_hrd, total_hrd,
                keterangan
              )
              VALUES ?
            `;

            db.query(sqlInsertDetails, [detailValues], (err5) => {
              if (err5) return callback(err5);
              callback(null, { message: 'RAB dan rincian biaya berhasil diajukan ke HRD untuk diverifikasi!', id_rab });
            });
          });
        });
      });
    });
  },

  reviewByHrd: (id_rab, status, catatan, updatedDetails, callback) => {
    // 1. Get SPPD details associated with RAB
    const sqlGetSppd = `
      SELECT 
        s.id_sppd,
        s.id_user,
        s.nomor_sppd,
        DATE_FORMAT(s.tanggal_mulai, '%Y-%m-%d') AS tanggal_mulai,
        DATE_FORMAT(s.tanggal_selesai, '%Y-%m-%d') AS tanggal_selesai,
        s.transportasi_perusahaan,
        r.status AS current_rab_status 
      FROM rab r 
      JOIN sppd s ON r.id_sppd = s.id_sppd 
      WHERE r.id = ?
    `;

    db.query(sqlGetSppd, [id_rab], (errSppd, sppdRows) => {
      if (errSppd) return callback(errSppd);
      if (sppdRows.length === 0) return callback(new Error('Data RAB tidak ditemukan!'));

      const sppd = sppdRows[0];
      const today = new Date();
      const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
      const endStr = sppd.tanggal_selesai;

      // Check date deadline
      if (endStr && todayStr > endStr) {
        return callback(new Error('Batas waktu peninjauan dan penyesuaian RAB telah berakhir (melewati tanggal selesai dinas)!'));
      }

      if (status === 'rejected') {
        if (!catatan || !catatan.trim()) {
          return callback(new Error('Alasan penolakan wajib diisi oleh HRD!'));
        }

        const sqlRab = `UPDATE rab SET status = 'rejected_hrd', catatan_hrd = ? WHERE id = ?`;
        db.query(sqlRab, [catatan, id_rab], (err1) => {
          if (err1) return callback(err1);

          const sqlSppd = `UPDATE sppd SET status_hrd = 'rejected', status_sppd = 'rejected' WHERE id_sppd = ?`;
          db.query(sqlSppd, [sppd.id_sppd], (err2) => {
            if (err2) return callback(err2);

            if (sppd.transportasi_perusahaan) {
              db.query(`UPDATE transportasi_perusahaan SET status = 'available' WHERE id = ?`, [sppd.transportasi_perusahaan], () => {});
            }

            callback(null, { message: 'SPPD & RAB berhasil ditolak oleh HRD.' });
          });
        });
        return;
      }

      // Status === 'approved' (Initial approval or dynamic cost adjustment by HRD)
      const sqlRab = `UPDATE rab SET status = 'approved', catatan_hrd = ? WHERE id = ?`;
      db.query(sqlRab, [catatan || null, id_rab], (err1) => {
        if (err1) return callback(err1);

        // Update SPPD to approved
        db.query(`UPDATE sppd SET status_hrd = 'approved', status_sppd = 'approved' WHERE id_sppd = ?`, [sppd.id_sppd]);

        // Occupy company transport if used
        if (sppd.transportasi_perusahaan) {
          db.query(`UPDATE transportasi_perusahaan SET status = 'occupied' WHERE id = ?`, [sppd.transportasi_perusahaan]);
        }

        // Force assign schedule to Dinas (id_skema = 11) for all SPPD dates
        db.query(`SELECT id_skema FROM pengaturan_skema WHERE key_setting = 'skema_dinas'`, (errSetting, settingRes) => {
          const idSkemaDinas = settingRes && settingRes.length > 0 ? settingRes[0].id_skema : 11;

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
            db.query(sqlJadwal, [values], (errJadwal) => {
              if (errJadwal) console.error('[RabModel] Error updating jadwal to Dinas:', errJadwal);
            });
          }
        });

        // Update rab_detail with HRD adjustments while preserving original atasan values!
        if (Array.isArray(updatedDetails) && updatedDetails.length > 0) {
          let pendingUpdates = updatedDetails.length;
          let hasError = false;

          updatedDetails.forEach((item) => {
            const qHrd = Number(item.jumlah_hrd !== undefined && item.jumlah_hrd !== null ? item.jumlah_hrd : item.jumlah) || 1;
            const hHrd = parseFloat(item.harga_satuan_hrd !== undefined && item.harga_satuan_hrd !== null ? item.harga_satuan_hrd : item.harga_satuan) || 0;
            const tHrd = parseFloat(item.total_hrd !== undefined && item.total_hrd !== null ? item.total_hrd : (qHrd * hHrd));
            const ket = item.keterangan || null;

            if (item.id) {
              // Update existing detail's HRD columns
              const sqlUpd = `
                UPDATE rab_detail 
                SET jumlah_hrd = ?, harga_satuan_hrd = ?, total_hrd = ?, keterangan = ?
                WHERE id = ? AND id_rab = ?
              `;
              db.query(sqlUpd, [qHrd, hHrd, tHrd, ket, item.id, id_rab], (errU) => {
                if (errU && !hasError) {
                  hasError = true;
                  return callback(errU);
                }
                pendingUpdates--;
                if (pendingUpdates === 0 && !hasError) {
                  callback(null, { message: 'RAB & SPPD berhasil disetujui dan penyesuaian biaya berhasil disimpan oleh HRD!' });
                }
              });
            } else {
              // Newly added item by HRD
              const sqlIns = `
                INSERT INTO rab_detail (
                  id_rab, id_komponen, tanggal, tipe_komponen,
                  jumlah, harga_satuan, total,
                  jumlah_hrd, harga_satuan_hrd, total_hrd,
                  keterangan
                ) VALUES (?, ?, ?, ?, 0, 0, 0, ?, ?, ?, ?)
              `;
              const tipe = item.tipe_komponen || 'harian';
              let tgl = item.tanggal || null;
              if (tipe === 'sekali' && (!tgl || tgl === 'null' || tgl === 'undefined')) {
                tgl = sppd.tanggal_mulai ? (typeof sppd.tanggal_mulai === 'object' && sppd.tanggal_mulai instanceof Date ? sppd.tanggal_mulai.toISOString().split('T')[0] : sppd.tanggal_mulai.toString().split('T')[0]) : null;
              }
              db.query(sqlIns, [id_rab, item.id_komponen, tgl, tipe, qHrd, hHrd, tHrd, ket], (errI) => {
                if (errI && !hasError) {
                  hasError = true;
                  return callback(errI);
                }
                pendingUpdates--;
                if (pendingUpdates === 0 && !hasError) {
                  callback(null, { message: 'RAB & SPPD berhasil disetujui dan penyesuaian biaya berhasil disimpan oleh HRD!' });
                }
              });
            }
          });
        } else {
          callback(null, { message: 'RAB & SPPD berhasil disetujui secara final oleh HRD!' });
        }
      });
    });
  },

  getAllPendingHrd: (callback) => {
    const sql = `
      SELECT 
        r.*,
        s.nomor_sppd,
        s.alamat_tujuan,
        s.tugas,
        DATE_FORMAT(s.tanggal_mulai, '%Y-%m-%d') AS tanggal_mulai,
        DATE_FORMAT(s.tanggal_selesai, '%Y-%m-%d') AS tanggal_selesai,
        s.total_hari,
        u.username AS nama_karyawan,
        c.username AS nama_pembuat
      FROM rab r
      JOIN sppd s ON r.id_sppd = s.id_sppd
      JOIN users u ON s.id_user = u.id_user
      LEFT JOIN users c ON s.id_creator = c.id_user
      WHERE r.status = 'pending_hrd'
      ORDER BY r.updatedAt DESC
    `;
    db.query(sql, callback);
  },
};

module.exports = RabModel;
