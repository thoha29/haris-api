const Absensi = require('../models/AbsensiLemburModel');
const ExcelJS = require('exceljs');
const db = require('../config/db');

// Helper untuk menghitung selisih menit antara dua string waktu (HH:mm:ss)
const getDiffMinutes = (start, end) => {
  if (!start || !end) return 0;
  const [h1, m1] = start.split(':').map(Number);
  const [h2, m2] = end.split(':').map(Number);
  return h2 * 60 + m2 - (h1 * 60 + m1);
};

// --- PROSES CHECK-IN (REVISI BYPASS TOTAL) ---
exports.postCheckIn = (req, res) => {
  const data = req.body;

  if (!data.id_user || !data.tanggal || !data.jam_masuk) {
    return res.status(400).json({
      error: 'Data check-in tidak lengkap!',
    });
  }

  // Cek apakah sudah absen lembur (yang belum checkout)
  const sqlCek = `
    SELECT * FROM absensi_lembur 
    WHERE id_user = ? AND jam_keluar IS NULL
    LIMIT 1
  `;

  db.query(sqlCek, [data.id_user], (err, results) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }

    if (results.length > 0) {
      return res.status(400).json({
        error: 'Masih ada lembur yang belum di check-out!',
      });
    }

    const insertQuery = `
      INSERT INTO absensi_lembur (
        id_user,
        id_skema,
        tanggal,
        jam_masuk,
        lokasi_absensi,
        latitude,
        longitude,
        status_user,
        status_hrd
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    const values = [
      data.id_user,
      data.id_skema,
      data.tanggal,
      data.jam_masuk,
      data.lokasi_absensi,
      data.latitude,
      data.longitude,
      'pending',
      'approved',
    ];

    db.query(insertQuery, values, (err) => {
      if (err) {
        return res.status(500).json({ error: err.message });
      }

      return res.status(201).json({
        message: 'Check-in lembur berhasil!',
      });
    });
  });
};

// --- PROSES CHECK-OUT (REVISI PERHITUNGAN LEMBUR) ---
exports.updateCheckOut = async (req, res) => {
  try {
    const {
      id_user,
      tanggal_keluar,
      jam_keluar,
      latitude,
      longitude,
      lokasi_absensi,
    } = req.body;

    const [rows] = await db.query(
      `
      SELECT id_absensi_lembur, tanggal, jam_masuk
      FROM absensi_lembur
      WHERE id_user = ?
      AND jam_keluar IS NULL
      ORDER BY id_absensi_lembur DESC
      LIMIT 1
      `,
      [id_user]
    );

    if (rows.length === 0) {
      return res.status(400).json({
        error: 'Anda belum absen masuk hari ini!',
      });
    }

    const dataAbsen = rows[0];

    console.log('DATA ABSEN FULL:', dataAbsen);

    // 🔥 fallback jika tanggal null
    const tanggalMasuk = dataAbsen.tanggal || tanggal_keluar;

    function parseDateTimeFlexible(tanggal, jam) {
      try {
        if (!tanggal) return null;

        // 🔥 jika tanggal sudah datetime
        let dateObj;

        if (typeof tanggal === 'object') {
          dateObj = new Date(tanggal);
        } else {
          dateObj = new Date(tanggal);
        }

        if (isNaN(dateObj)) return null;

        // 🔥 jika jam kosong → ambil dari tanggal
        let hour = 0,
          minute = 0,
          second = 0;

        if (jam) {
          if (jam.includes(':')) {
            const parts = jam.split(':').map(Number);
            hour = parts[0] || 0;
            minute = parts[1] || 0;
            second = parts[2] || 0;
          } else {
            // kemungkinan jam berupa datetime juga
            const jamDate = new Date(jam);
            if (!isNaN(jamDate)) {
              hour = jamDate.getHours();
              minute = jamDate.getMinutes();
              second = jamDate.getSeconds();
            }
          }
        } else {
          // 🔥 fallback ambil dari tanggal
          hour = dateObj.getHours();
          minute = dateObj.getMinutes();
          second = dateObj.getSeconds();
        }

        return new Date(
          dateObj.getFullYear(),
          dateObj.getMonth(),
          dateObj.getDate(),
          hour,
          minute,
          second
        );
      } catch (err) {
        return null;
      }
    }

    const masukDateTime = parseDateTimeFlexible(
      dataAbsen.tanggal,
      dataAbsen.jam_masuk
    );

    const keluarDateTime = parseDateTimeFlexible(tanggal_keluar, jam_keluar);
    if (!masukDateTime || !keluarDateTime) {
      return res.status(400).json({
        error: 'Format tanggal atau jam tidak valid!',
      });
    }

    const selisihMs = keluarDateTime - masukDateTime;

    if (selisihMs < 0) {
      return res.status(400).json({
        error: 'Jam keluar tidak boleh lebih kecil dari jam masuk!',
      });
    }

    const totalJam = selisihMs / (1000 * 60 * 60);
    const total_jam_kerja = Number(totalJam.toFixed(2));

    await db.query(
      `
      UPDATE absensi_lembur
      SET 
        jam_keluar = ?,
        tanggal_keluar = ?,
        total_jam_kerja = ?,
        latitude = ?,
        longitude = ?,
        lokasi_absensi = ?
      WHERE id_absensi_lembur = ?
      `,
      [
        jam_keluar,
        tanggal_keluar,
        total_jam_kerja,
        latitude || 0,
        longitude || 0,
        lokasi_absensi || '-',
        dataAbsen.id_absensi_lembur, // ✅ FIX DISINI
      ]
    );

    return res.json({
      message: 'Check-out berhasil',
      total_jam_kerja,
    });
  } catch (error) {
    console.error('ERROR CHECKOUT:', error);
    return res.status(500).json({
      error: error.message,
    });
  }
};
// --- APPROVAL FINAL OLEH USER ---
exports.approveByUser = (req, res) => {
  const { id_absensi_lembur, status } = req.body;

  if (!id_absensi_lembur) {
    return res.status(400).json({
      error: 'ID Absensi tidak ditemukan!',
    });
  }

  Absensi.updateStatusUser(id_absensi_lembur, status, (err, result) => {
    if (err) {
      return res.status(500).json({
        error: err.message,
      });
    }

    res.json({
      message: status === 'rejected' ? 'Absensi ditolak' : 'Absensi disetujui',
    });
  });
};

// --- APPROVAL HRD DINONAKTIFKAN ---

// --- MONITORING & RIWAYAT ---
exports.getPendingUser = (req, res) => {
  Absensi.getPendingForUser((err, results) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(results);
  });
};

exports.getRiwayatUser = (req, res) => {
  Absensi.getRiwayatForUser((err, results) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(results);
  });
};

exports.getAllAbsensi = (req, res) => {
  Absensi.getAll((err, results) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(results);
  });
};

exports.getRiwayat = (req, res) => {
  Absensi.getByUserId(req.params.id_user, (err, results) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(results);
  });
};

exports.getListKaryawan = (req, res) => {
  Absensi.getAllEmployees((err, results) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(results);
  });
};

exports.getPendingHRD = (req, res) => {
  Absensi.getPendingForHRD((err, results) => {
    if (err) {
      return res.status(500).json({
        error: err.message,
      });
    }

    res.json(results);
  });
};

exports.approveByHRD = (req, res) => {
  const { id_absensi_lembur, status } = req.body;

  Absensi.approveByHRD(id_absensi_lembur, status, (err, result) => {
    if (err) {
      return res.status(500).json({
        error: err.message,
      });
    }

    res.json({
      message: status === 'approved' ? 'Disetujui HRD' : 'Ditolak HRD',
    });
  });
};

// --- EXPORT EXCEL ---
exports.exportExcel = (req, res) => {
  const id_user = req.params.id_user;
  Absensi.getByUserId(id_user, async (err, results) => {
    if (err) return res.status(500).json({ error: err.message });
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Riwayat Absensi');

    worksheet.columns = [
      { header: 'Tanggal', key: 'tanggal', width: 15 },
      { header: 'Jam Masuk', key: 'jam_masuk', width: 15 },
      { header: 'Jam Keluar', key: 'jam_keluar', width: 15 },
      { header: 'Total Kerja', key: 'total_jam_kerja', width: 20 },
      { header: 'Telat (m)', key: 'keterlambatan', width: 12 },
      { header: 'Lembur (Jam)', key: 'lembur', width: 14 },
      { header: 'Status Final', key: 'is_approved', width: 15 },
    ];

    worksheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFF' } };
    worksheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: '4F81BD' },
    };

    results.forEach((item) => {
      worksheet.addRow({
        tanggal: new Date(item.tanggal).toLocaleDateString('id-ID'),
        jam_masuk: item.jam_masuk,
        jam_keluar: item.jam_keluar || '--:--',
        total_jam_kerja: item.total_jam_kerja || '0 jam 0 menit',
        keterlambatan: item.keterlambatan || 0,
        lembur: item.lembur || 0,
        is_approved: item.is_approved,
      });
    });

    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    res.setHeader(
      'Content-Disposition',
      `attachment; filename=Riwayat_Absensi_${id_user}.xlsx`
    );
    await workbook.xlsx.write(res);
    res.end();
  });
};

exports.getRiwayatHRD = (req, res) => {
  const { id_user } = req.params;
  Absensi.getByUserId(id_user, (err, results) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(results);
  });
};

// --- EDIT ABSENSI OLEH HRD ---
exports.editAbsensiHRD = (req, res) => {
  const { id_absensi_lembur } = req.params;
  const {
    jam_masuk,
    jam_keluar,
    total_jam_kerja,
    keterlambatan,
    lembur,
    status,
    status_hrd,
    is_approved,
  } = req.body;

  if (!id_absensi_lembur) {
    return res.status(400).json({ error: 'ID Data Absensi diperlukan' });
  }

  const dataUpdate = {
    jam_masuk: jam_masuk || '',
    jam_keluar: jam_keluar || null,
    total_jam_kerja: total_jam_kerja || '0 jam 0 menit',
    keterlambatan: keterlambatan || 0,
    lembur: lembur || 0,
    status: status || 'Hadir',
    status_hrd: status_hrd || 'pending',
    is_approved: is_approved || 'pending',
  };

  Absensi.updateAbsensiByHRD(id_absensi_lembur, dataUpdate, (err, result) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ message: 'Data absensi berhasil diperbarui oleh HRD!' });
  });
};

// --- HAPUS SATU DATA ABSENSI LEMBUR ---
exports.hapusAbsensiLemburHRD = (req, res) => {
  const { id_absensi_lembur } = req.params;
  if (!id_absensi_lembur) {
    return res.status(400).json({ error: 'ID Data Absensi Lembur diperlukan' });
  }
  Absensi.deleteById(id_absensi_lembur, (err, result) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ message: 'Data absensi lembur berhasil dihapus!' });
  });
};
