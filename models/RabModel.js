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
          IFNULL(rd.jumlah_final, rd.jumlah) AS jumlah_final,
          IFNULL(rd.harga_satuan_final, rd.harga_satuan) AS harga_satuan_final,
          IFNULL(rd.total_final, rd.total) AS total_final,
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
        let grandTotalFinal = 0;

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
              total_jumlah_final: 0,
              total_biaya_final: 0,
              // total_jumlah_hrd: 0,
              // total_biaya_hrd: 0,
              selisih_biaya: 0,
            };
          }

          const qAtasan = Number(d.jumlah) || 0;
          const bAtasan = parseFloat(d.total) || (qAtasan * (parseFloat(d.harga_satuan) || 0));
          const qFinal = d.jumlah_final !== null && d.jumlah_final !== undefined ? Number(d.jumlah_final) : qAtasan;
          const bFinal = d.total_final !== null && d.total_final !== undefined
            ? parseFloat(d.total_final)
            : (qFinal * (parseFloat(d.harga_satuan_final || d.harga_satuan) || 0));

          summaryMap[compId].total_jumlah_atasan += qAtasan;
          summaryMap[compId].total_biaya_atasan += bAtasan;
          summaryMap[compId].total_jumlah_final += qFinal;
          summaryMap[compId].total_biaya_final += bFinal;
          // summaryMap[compId].total_jumlah_hrd = summaryMap[compId].total_jumlah_final;
          // summaryMap[compId].total_biaya_hrd = summaryMap[compId].total_biaya_final;
          summaryMap[compId].selisih_biaya = summaryMap[compId].total_biaya_final - summaryMap[compId].total_biaya_atasan;

          grandTotalAtasan += bAtasan;
          grandTotalFinal += bFinal;
        });

        rab.summary_per_komponen = Object.values(summaryMap);
        rab.grand_total_atasan = grandTotalAtasan;
        rab.grand_total_final = grandTotalFinal;
        rab.selisih_grand_total = grandTotalFinal - grandTotalAtasan;

        callback(null, rab);
      });
    });
  },

  submitRab: (id_sppd, detailsArray, callback) => {
    // 1. Verify SPPD exists
    db.query(`SELECT * FROM sppd WHERE id_sppd = ?`, [id_sppd], (err, sppdRows) => {
      if (err) return callback(err);
      if (sppdRows.length === 0) return callback(new Error('SPPD tidak ditemukan!'));

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

      // Check existing RAB status and details
      db.query(`SELECT id, status FROM rab WHERE id_sppd = ?`, [id_sppd], (errRab, rabRows) => {
        if (errRab) return callback(errRab);

        const existingRab = rabRows && rabRows.length > 0 ? rabRows[0] : null;
        const isRevisi = existingRab && existingRab.status === 'revisi_atasan';
        const existingRabId = existingRab ? existingRab.id : null;

        // Helper to process insert/update details
        const processInsertDetails = (id_rab, prevDetailsMap = {}) => {
          // Delete existing details to replace with updated state
          db.query(`DELETE FROM rab_detail WHERE id_rab = ?`, [id_rab], (err4) => {
            if (err4) return callback(err4);

            if (!detailsArray || detailsArray.length === 0) {
              return callback(null, { message: 'RAB berhasil disimpan tanpa rincian item', id_rab });
            }

            const detailValues = detailsArray.map((item) => {
              const revisedQty = Number(item.jumlah) || 1;
              const revisedPrice = parseFloat(item.harga_satuan) || 0;
              const revisedTotal = parseFloat(item.total) || (revisedQty * revisedPrice);
              const tipeKomponen = item.tipe_komponen || 'harian';
              let tanggal = item.tanggal ? item.tanggal : null;
              if (tipeKomponen === 'sekali' && (!tanggal || tanggal === 'null' || tanggal === 'undefined')) {
                tanggal = firstDay;
              }
              const keterangan = item.keterangan || null;

              // If this is a revision, keep initial submission (Pengajuan Awal) from prevDetailsMap if available,
              // while recording the newest revision strictly in jumlah_final, harga_satuan_final, total_final.
              const lookupKey = `${item.id_komponen}_${tanggal || ''}_${tipeKomponen}`;
              const prevItem = prevDetailsMap[lookupKey];

              let initialJumlah = revisedQty;
              let initialHargaSatuan = revisedPrice;
              let initialTotal = revisedTotal;

              if (isRevisi) {
                if (prevItem) {
                  // Preserve initial submission
                  initialJumlah = prevItem.jumlah;
                  initialHargaSatuan = prevItem.harga_satuan;
                  initialTotal = prevItem.total;
                } else {
                  // Newly added item during revision: initial submission was 0
                  initialJumlah = 0;
                  initialHargaSatuan = 0;
                  initialTotal = 0;
                }
              }

              const jumlahFinal = revisedQty;
              const hargaSatuanFinal = revisedPrice;
              const totalFinal = revisedTotal;

              return [
                id_rab,
                item.id_komponen,
                tanggal,
                tipeKomponen,
                initialJumlah,
                initialHargaSatuan,
                initialTotal,
                jumlahFinal,
                hargaSatuanFinal,
                totalFinal,
                keterangan,
              ];
            });

            const sqlInsertDetails = `
              INSERT INTO rab_detail (
                id_rab, id_komponen, tanggal, tipe_komponen,
                jumlah, harga_satuan, total,
                jumlah_final, harga_satuan_final, total_final,
                keterangan
              )
              VALUES ?
            `;

            db.query(sqlInsertDetails, [detailValues], (err5) => {
              if (err5) return callback(err5);
              callback(null, {
                message: isRevisi
                  ? 'Revisi RAB berhasil diajukan kembali ke atasan untuk disetujui!'
                  : 'RAB dan rincian biaya berhasil diajukan, menunggu persetujuan atasan!',
                id_rab,
              });
            });
          });
        };

        const sqlRab = `
          INSERT INTO rab (id_sppd, status, perubahan)
          VALUES (?, 'pending_atasan', 'none')
          ON DUPLICATE KEY UPDATE status = IF(status = 'revisi_atasan', 'pending_atasan', status), perubahan = 'none', catatan_atasan = NULL, updatedAt = CURRENT_TIMESTAMP
        `;

        db.query(sqlRab, [id_sppd], (err2) => {
          if (err2) return callback(err2);

          db.query(`SELECT id FROM rab WHERE id_sppd = ?`, [id_sppd], (err3, rabRows2) => {
            if (err3 || rabRows2.length === 0) return callback(err3 || new Error('Gagal mengambil ID RAB'));
            const id_rab = rabRows2[0].id;

            if (isRevisi && existingRabId) {
              // Fetch existing details before deleting to preserve original submission values
              db.query(`SELECT * FROM rab_detail WHERE id_rab = ?`, [existingRabId], (errPrev, prevRows) => {
                const prevMap = {};
                (prevRows || []).forEach((r) => {
                  const tglStr = r.tanggal
                    ? (typeof r.tanggal === 'object' && r.tanggal instanceof Date
                      ? r.tanggal.toISOString().split('T')[0]
                      : r.tanggal.toString().split('T')[0])
                    : '';
                  const key = `${r.id_komponen}_${tglStr}_${r.tipe_komponen}`;
                  prevMap[key] = {
                    jumlah: Number(r.jumlah) || 0,
                    harga_satuan: parseFloat(r.harga_satuan) || 0,
                    total: parseFloat(r.total) || 0,
                  };
                });
                processInsertDetails(id_rab, prevMap);
              });
            } else {
              processInsertDetails(id_rab, {});
            }
          });
        });
      });
    });
  },

  // ─── REVIEW OLEH ATASAN ──────────────────────────────────────────────────────
  reviewByAtasan: (id_rab, action, catatan, callback) => {
    const sql = `
      SELECT r.*, s.status_sppd, s.status_atasan, s.id_sppd
      FROM rab r
      JOIN sppd s ON r.id_sppd = s.id_sppd
      WHERE r.id = ?
    `;
    db.query(sql, [id_rab], (err, rows) => {
      if (err) return callback(err);
      if (rows.length === 0) return callback(new Error('Data RAB tidak ditemukan!'));
      const rab = rows[0];

      if (action === 'revisi') {
        if (!catatan || !catatan.trim()) {
          return callback(new Error('Catatan revisi wajib diisi!'));
        }
        const sqlUpdate = `UPDATE rab SET status = 'revisi_atasan', catatan_atasan = ? WHERE id = ?`;
        return db.query(sqlUpdate, [catatan, id_rab], (errU) => {
          if (errU) return callback(errU);
          db.query(`UPDATE sppd SET catatan_atasan = ? WHERE id_sppd = ?`, [catatan, rab.id_sppd], () => {
            callback(null, { message: 'RAB dikembalikan ke karyawan untuk direvisi.' });
          });
        });
      }

      if (action === 'approve') {
        // Lanjutkan ke persetujuan final (HRD) dan update status SPPD & Atasan
        const sqlUpdate = `UPDATE rab SET status = 'pending_hrd', catatan_atasan = NULL WHERE id = ?`;
        return db.query(sqlUpdate, [id_rab], (errU) => {
          if (errU) return callback(errU);
          db.query(
            `UPDATE sppd SET status_sppd = 'approved_atasan', status_atasan = 'approved' WHERE id_sppd = ?`,
            [rab.id_sppd],
            () => {
              callback(null, { message: 'RAB disetujui atasan dan diteruskan untuk persetujuan final.' });
            }
          );
        });
      }

      return callback(new Error('Aksi tidak valid. Gunakan: revisi atau approve'));
    });
  },

  // ─── PERSETUJUAN FINAL OLEH HRD (hanya approve, tidak ada edit rincian) ────────
  reviewByHrd: (id_rab, catatan, callback) => {
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

      // Update RAB to approved (final)
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

        callback(null, { message: 'RAB & SPPD berhasil disetujui secara final!' });
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

  getAllPendingAtasan: (callback) => {
    const sql = `
      SELECT 
        r.*,
        s.nomor_sppd,
        s.alamat_tujuan,
        s.tugas,
        DATE_FORMAT(s.tanggal_mulai, '%Y-%m-%d') AS tanggal_mulai,
        DATE_FORMAT(s.tanggal_selesai, '%Y-%m-%d') AS tanggal_selesai,
        s.total_hari,
        s.status_sppd,
        u.username AS nama_karyawan,
        c.username AS nama_pembuat
      FROM rab r
      JOIN sppd s ON r.id_sppd = s.id_sppd
      JOIN users u ON s.id_user = u.id_user
      LEFT JOIN users c ON s.id_creator = c.id_user
      WHERE r.status IN ('pending_atasan', 'revisi_atasan')
      ORDER BY r.updatedAt DESC
    `;
    db.query(sql, callback);
  },
};

module.exports = RabModel;
