const Absensi = require('../models/AbsensiModel');
const ExcelJS = require('exceljs');
const db = require('../config/db');

// Helper untuk menghitung lembur konversi (1 jam pertama = 1.5x, jam berikutnya = 2.0x)
const calculateLemburKonversi = (actualHours, isHoliday = false) => {
  const hours = parseFloat(actualHours) || 0;
  if (hours <= 0) return 0;

  if (isHoliday) {
    if (hours <= 8) return Number((hours * 2.0).toFixed(2));
    if (hours <= 9) return Number((8 * 2.0 + (hours - 8) * 3.0).toFixed(2));
    return Number((8 * 2.0 + 1 * 3.0 + (hours - 9) * 4.0).toFixed(2));
  } else {
    if (hours <= 1) return Number((hours * 1.5).toFixed(2));
    return Number((1 * 1.5 + (hours - 1) * 2.0).toFixed(2));
  }
};

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

  console.log('GPS:', {
    latitude: data.latitude,
    longitude: data.longitude,
  });

  if (!data.id_user || !data.tanggal || !data.jam_masuk) {
    return res.status(400).json({
      error: 'Data check-in tidak lengkap!',
    });
  }

  // Cek apakah sudah absen hari ini
  Absensi.checkTodayAttendance(data.id_user, data.tanggal, (err, results) => {
    if (err) {
      return res.status(500).json({
        error: err.message,
      });
    }

    if (results.length > 0) {
      return res.status(400).json({
        error: 'Sudah absen hari ini!',
      });
    }

    // ==========================================
    // JIKA TIDAK PUNYA SKEMA
    // ==========================================
    if (!data.id_skema) {
      const finalData = {
        id_user: data.id_user,
        id_skema: null,
        tanggal: data.tanggal,
        jam_masuk: data.jam_masuk,
        keterlambatan: 0,
        lokasi_absensi: data.lokasi_absensi,
        latitude: data.latitude,
        longitude: data.longitude,
        status: 'Hadir',
        status_user: 'approved',
        status_hrd: 'approved',
      };

      return Absensi.checkIn(finalData, (err, result) => {
        if (err) {
          return res.status(500).json({
            error: err.message,
          });
        }

        return res.status(201).json({
          message: 'Check-in berhasil (Tanpa Shift)',
        });
      });
    }

    // ==========================================
    // JIKA PUNYA SKEMA
    // ==========================================
    const sqlSkema = `
            SELECT
                jam_masuk,
                jam_keluar,
                toleransi_menit
            FROM skema_absensi
            WHERE id_skema = ?
        `;

    db.query(sqlSkema, [data.id_skema], (err, skemaResults) => {
      if (err) {
        return res.status(500).json({
          error: 'Database error: ' + err.message,
        });
      }

      if (skemaResults.length === 0) {
        return res.status(404).json({
          error: 'Skema tidak ditemukan!',
        });
      }

      const skema = skemaResults[0];

      const selisihAwal = getDiffMinutes(skema.jam_masuk, data.jam_masuk);

      const selisihAkhir = getDiffMinutes(skema.jam_keluar, data.jam_masuk);

      // Jika datang setelah jam kerja selesai
      if (selisihAkhir >= 0) {
        const insertAlphaQuery = `
                        INSERT INTO absensi (
                            id_user,
                            id_skema,
                            tanggal,
                            jam_masuk,
                            jam_keluar,
                            status,
                            is_approved,
                            status_user,
                            status_hrd,
                            keterlambatan,
                            lembur,
                            total_jam_kerja
                        )
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    `;

        const values = [
          data.id_user,
          data.id_skema,
          data.tanggal,
          '00:00:00',
          '00:00:00',
          'Alpha',
          'approved',
          'approved',
          'approved',
          0,
          0,
          '0 jam 0 menit',
        ];

        db.query(insertAlphaQuery, values, (err) => {
          if (err) {
            console.error('Error insert Alpha:', err);
          }

          return res.status(403).json({
            error: 'Shift sudah berakhir. Otomatis tercatat Alpha.',
          });
        });

        return;
      }

      const keterlambatan =
        selisihAwal > skema.toleransi_menit ? selisihAwal : 0;

      const finalData = {
        ...data,
        keterlambatan,
        status: 'Hadir',
        status_user: 'pending',
      };

      Absensi.checkIn(finalData, (err, result) => {
        if (err) {
          return res.status(500).json({
            error: err.message,
          });
        }

        return res.status(201).json({
          message:
            keterlambatan > 0
              ? `Check-in berhasil (Terlambat ${keterlambatan} menit)`
              : 'Check-in berhasil (Tepat Waktu)',
        });
      });
    });
  });
};

// --- PROSES CHECK-OUT (REVISI PERHITUNGAN LEMBUR) ---
exports.updateCheckOut = (req, res) => {
  const { id_user, tanggal, jam_keluar, tanggal_keluar } = req.body;

  const sqlCekMasuk = `
        SELECT a.id_data_absensi, a.jam_masuk, a.id_skema, s.jam_keluar as jam_pulang_skema 
        FROM absensi a 
        LEFT JOIN skema_absensi s ON a.id_skema = s.id_skema 
        WHERE a.id_user = ? AND a.jam_keluar IS NULL
        ORDER BY a.id_data_absensi DESC LIMIT 1`;

  db.query(sqlCekMasuk, [id_user], (err, results) => {
    if (err) return res.status(500).json({ error: 'DB Error: ' + err.message });
    if (results.length === 0)
      return res
        .status(400)
        .json({ error: 'Anda belum absen masuk hari ini!' });

    const dataAbsen = results[0];

    // Hitung lembur hanya jika ada skema (Bypass untuk USER/HRD tanpa skema)
    let lembur = 0;
    if (dataAbsen.jam_pulang_skema) {
      const selisihKeluar = getDiffMinutes(
        dataAbsen.jam_pulang_skema,
        jam_keluar
      );
      // Konversi dari menit ke jam, bulatkan 1 desimal (e.g., 90 menit -> 1.5 jam)
      lembur = selisihKeluar > 0 ? Number((selisihKeluar / 60).toFixed(1)) : 0;
    }

    const totalMenitKerja = getDiffMinutes(dataAbsen.jam_masuk, jam_keluar);
    // INI YANG MASUK KE DB
    const totalJamKerja = Number((totalMenitKerja / 60).toFixed(2));

    // INI HANYA UNTUK TAMPILAN
    const jam = Math.floor(totalMenitKerja / 60);
    const menit = totalMenitKerja % 60;
    const totalJamKerjaFormatted = `${jam} jam ${menit} menit`;

    Absensi.checkOut(
      id_user,
      jam_keluar,
      lembur,
      totalJamKerja,
      tanggal_keluar,
      (err, result) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({
          message: `Check-out berhasil!`,
          durasi: totalJamKerjaFormatted,
          lembur: lembur > 0 ? `${lembur} jam` : '0',
        });
      }
    );
  });
};
// --- APPROVAL FINAL OLEH USER ---
exports.approveByUser = (req, res) => {
  const { id_data_absensi, status } = req.body;

  if (!id_data_absensi) {
    return res.status(400).json({
      error: 'ID Absensi tidak ditemukan!',
    });
  }

  Absensi.updateStatusUser(id_data_absensi, status, (err, result) => {
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
  const { id_data_absensi, status } = req.body;

  Absensi.approveByHRD(id_data_absensi, status, (err, result) => {
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
  const { id_data_absensi } = req.params;
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

  if (!id_data_absensi) {
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

  Absensi.updateAbsensiByHRD(id_data_absensi, dataUpdate, (err, result) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ message: 'Data absensi berhasil diperbarui oleh HRD!' });
  });
};

exports.prosesSemua = (req, res) => {
  const { tanggal, tanggal_keluar } = req.body;

  if (!tanggal || !tanggal_keluar) {
    return res.status(400).json({
      message: 'Parameter tidak lengkap',
    });
  }

  Absensi.replaceAllProses(tanggal, tanggal_keluar, (err, result) => {
    if (err) {
      console.error(err);
      return res.status(500).json({
        message: 'Gagal proses semua data',
        error: err.message,
      });
    }

    res.json(result);
  });
};

// --- REPORT LENGKAP HISTORI ABSENSI & LEMBUR (MENU HRD) ---
exports.getReportLengkapHRD = async (req, res) => {
  const { id_user } = req.params;
  const month = parseInt(req.query.month) || new Date().getMonth() + 1;
  const year = parseInt(req.query.year) || new Date().getFullYear();

  try {
    // 1. Data Karyawan
    const [userRows] = await db.query(
      `SELECT u.id_user, u.username, u.role, dp.nik, dp.nama_lengkap, dp.jabatan, dp.divisi, dp.tipe_kerja, dp.lokasi_kerja, dp.tanggal_masuk
       FROM users u
       LEFT JOIN data_pribadi dp ON u.id_user = dp.id_user
       WHERE u.id_user = ?`,
      [id_user]
    );

    if (userRows.length === 0) {
      return res.status(404).json({ error: 'Karyawan tidak ditemukan' });
    }

    const karyawan = userRows[0];

    // 2. Data Absensi Reguler
    const [absensiRows] = await db.query(
      `SELECT a.*, s.nama_skema, s.jam_masuk AS skema_masuk, s.jam_keluar AS skema_keluar
       FROM absensi a
       LEFT JOIN skema_absensi s ON a.id_skema = s.id_skema
       WHERE a.id_user = ? AND MONTH(a.tanggal) = ? AND YEAR(a.tanggal) = ?
       ORDER BY a.tanggal ASC, a.jam_masuk ASC`,
      [id_user, month, year]
    );

    // 3. Data Absensi Lembur
    const [lemburRows] = await db.query(
      `SELECT al.*, s.nama_skema, s.jam_masuk AS skema_masuk, s.jam_keluar AS skema_keluar
       FROM absensi_lembur al
       LEFT JOIN skema_absensi s ON al.id_skema = s.id_skema
       WHERE al.id_user = ? AND MONTH(al.tanggal) = ? AND YEAR(al.tanggal) = ?
       ORDER BY al.tanggal ASC, al.jam_masuk ASC`,
      [id_user, month, year]
    );

    // 4. Data Cuti
    const [cutiRows] = await db.query(
      `SELECT * FROM cuti
       WHERE id_user = ? 
         AND (
           (MONTH(tanggal_mulai) = ? AND YEAR(tanggal_mulai) = ?) OR
           (MONTH(tanggal_selesai) = ? AND YEAR(tanggal_selesai) = ?)
         )
         AND (status = 'approved' OR status_hrd = 'approved')
       ORDER BY tanggal_mulai ASC`,
      [id_user, month, year, month, year]
    );

    // 5. Data Jadwal Karyawan
    const [jadwalRows] = await db.query(
      `SELECT jk.*, s.nama_skema, s.jam_masuk AS skema_masuk, s.jam_keluar AS skema_keluar
       FROM jadwal_karyawan jk
       LEFT JOIN skema_absensi s ON jk.id_skema = s.id_skema
       WHERE jk.id_user = ? AND MONTH(jk.tanggal) = ? AND YEAR(jk.tanggal) = ?
       ORDER BY jk.tanggal ASC`,
      [id_user, month, year]
    );

    const daysInMonth = new Date(year, month, 0).getDate();

    let totalJamKerja = 0;
    let totalLemburAktual = 0;
    let totalLemburKonversi = 0;
    const totalHkDays = new Set();
    let shiftSiangCount = 0;
    let shiftMalamCount = 0;
    let cutiResmiCount = 0;
    let sakitIzinAlfaCount = 0;

    const items = [];

    const formatDateKey = (d) => {
      const dt = new Date(d);
      const y = dt.getFullYear();
      const m = String(dt.getMonth() + 1).padStart(2, '0');
      const day = String(dt.getDate()).padStart(2, '0');
      return `${y}-${m}-${day}`;
    };

    const parseWorkHours = (val) => {
      if (!val) return 0;
      if (typeof val === 'number') return val;
      const num = parseFloat(val);
      return isNaN(num) ? 0 : num;
    };

    // Process Absensi Reguler
    absensiRows.forEach((item) => {
      const dateKey = formatDateKey(item.tanggal);
      const statusStr = (item.status || '').toLowerCase();
      const isAlpha = statusStr === 'alpha';
      const isSakit = statusStr === 'sakit';
      const isIzin = statusStr === 'izin';

      const dateObj = new Date(item.tanggal);
      const isSunday = dateObj.getDay() === 0;
      const isHoliday = isSunday;

      const durasiKerja = parseWorkHours(item.total_jam_kerja);
      const lemburAktual = parseFloat(item.lembur) || 0;
      const lemburKonversi = calculateLemburKonversi(lemburAktual, isHoliday);

      if (!isAlpha && !isSakit && !isIzin) {
        totalHkDays.add(dateKey);
        totalJamKerja += durasiKerja;
        totalLemburAktual += lemburAktual;
        totalLemburKonversi += lemburKonversi;

        const skemaNama = (item.nama_skema || '').toLowerCase();
        const jamMsk = item.jam_masuk || item.skema_masuk || '';
        const hourMasuk = jamMsk ? parseInt(jamMsk.split(':')[0]) : 7;

        if (skemaNama.includes('malam') || hourMasuk >= 18) {
          shiftMalamCount++;
        } else {
          shiftSiangCount++;
        }
      } else {
        sakitIzinAlfaCount++;
      }

      let jamKerjaStr = '--:--';
      if (item.jam_masuk) {
        jamKerjaStr = `${item.jam_masuk.substring(0, 5)} - ${item.jam_keluar ? item.jam_keluar.substring(0, 5) : '??:??'
          }`;
      }

      items.push({
        id: `absensi_${item.id_data_absensi}`,
        type: 'absensi',
        raw_id: item.id_data_absensi,
        tanggal: item.tanggal,
        status_label: isAlpha
          ? 'ALPHA'
          : isSakit
            ? 'SAKIT'
            : isIzin
              ? 'IZIN'
              : `MASUK (${item.nama_skema || 'Biasa'})`,
        skema_nama: item.nama_skema || '-',
        is_holiday: isHoliday,
        jam_kerja: jamKerjaStr,
        total_jam_kerja: durasiKerja,
        lembur_aktual: lemburAktual,
        lembur_konversi: lemburKonversi,
        status_approval: item.status_hrd || item.is_approved || 'pending',
        can_delete: true,
      });
    });

    // Process Absensi Lembur
    lemburRows.forEach((item) => {
      const dateKey = formatDateKey(item.tanggal);
      const dateObj = new Date(item.tanggal);
      const isSunday = dateObj.getDay() === 0;
      const isHoliday = isSunday;

      const durasiLembur =
        parseWorkHours(item.total_jam_kerja) || parseFloat(item.lembur) || 0;
      const lemburKonversi = calculateLemburKonversi(durasiLembur, isHoliday);

      totalHkDays.add(dateKey);
      totalJamKerja += durasiLembur;
      totalLemburAktual += durasiLembur;
      totalLemburKonversi += lemburKonversi;

      let jamKerjaStr = '--:--';
      if (item.jam_masuk) {
        jamKerjaStr = `${item.jam_masuk.substring(0, 5)} - ${item.jam_keluar ? item.jam_keluar.substring(0, 5) : '??:??'
          }`;
      }

      items.push({
        id: `lembur_${item.id_absensi_lembur}`,
        type: 'lembur',
        raw_id: item.id_absensi_lembur,
        tanggal: item.tanggal,
        status_label: `LEMBUR (${item.nama_skema || (isHoliday ? 'Hari Libur' : 'Hari Biasa')
          })`,
        skema_nama: item.nama_skema || 'Lembur',
        is_holiday: isHoliday,
        jam_kerja: jamKerjaStr,
        total_jam_kerja: durasiLembur,
        lembur_aktual: durasiLembur,
        lembur_konversi: lemburKonversi,
        status_approval: item.status_hrd || item.is_approved || 'pending',
        can_delete: true,
      });
    });

    // Process Cuti
    cutiRows.forEach((item) => {
      const start = new Date(item.tanggal_mulai);
      const end = new Date(item.tanggal_selesai);

      let curr = new Date(start);
      while (curr <= end) {
        if (curr.getMonth() + 1 === month && curr.getFullYear() === year) {
          const dStr = formatDateKey(curr);
          const isOfficialLeave = (item.tipe || '')
            .toLowerCase()
            .includes('cuti');
          if (isOfficialLeave) {
            cutiResmiCount++;
          } else {
            sakitIzinAlfaCount++;
          }

          items.push({
            id: `cuti_${item.id_cuti}_${dStr}`,
            type: 'cuti',
            raw_id: item.id_cuti,
            tanggal: dStr,
            status_label: (item.tipe || 'CUTI').toUpperCase(),
            skema_nama: item.alasan || '-',
            is_holiday: false,
            jam_kerja: 'Cuti / Izin',
            total_jam_kerja: 0,
            lembur_aktual: 0,
            lembur_konversi: 0,
            status_approval: item.status_hrd || 'approved',
            can_delete: false,
          });
        }
        curr.setDate(curr.getDate() + 1);
      }
    });

    // Sort items chronologically
    items.sort((a, b) => new Date(a.tanggal) - new Date(b.tanggal));

    // Calculate OFF Murni (Sundays with no work and no cuti)
    let offMurniCount = 0;
    for (let d = 1; d <= daysInMonth; d++) {
      const dt = new Date(year, month - 1, d);
      const dateKey = formatDateKey(dt);
      const isSunday = dt.getDay() === 0;
      const hasPresence = totalHkDays.has(dateKey);
      const hasCuti = items.some(
        (it) => it.type === 'cuti' && formatDateKey(it.tanggal) === dateKey
      );

      if (!hasPresence && !hasCuti && isSunday) {
        offMurniCount++;
      }
    }

    res.json({
      karyawan,
      periode: {
        month,
        year,
        total_days_in_month: daysInMonth,
      },
      summary: {
        total_jam_kerja: Number(totalJamKerja.toFixed(1)),
        total_lembur_aktual: Number(totalLemburAktual.toFixed(1)),
        total_lembur_konversi: Number(totalLemburKonversi.toFixed(1)),
        total_hk: totalHkDays.size,
        shift_siang: shiftSiangCount,
        shift_malam: shiftMalamCount,
        cuti_resmi: cutiResmiCount,
        off_murni: offMurniCount,
        sakit_izin_alfa: sakitIzinAlfaCount,
      },
      items,
    });
  } catch (err) {
    console.error('Error report lengkap HRD:', err);
    res
      .status(500)
      .json({ error: 'Gagal mengambil report lengkap: ' + err.message });
  }
};

// --- HAPUS SATU DATA ABSENSI ---
exports.hapusAbsensiHRD = (req, res) => {
  const { id_data_absensi } = req.params;
  if (!id_data_absensi) {
    return res.status(400).json({ error: 'ID Data Absensi diperlukan' });
  }
  Absensi.deleteById(id_data_absensi, (err, result) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ message: 'Data absensi berhasil dihapus!' });
  });
};

// --- HAPUS SEMUA HISTORI (PERIODE TERPILIH) ---
exports.hapusSemuaHistoriHRD = (req, res) => {
  const { id_user } = req.params;
  const month = parseInt(req.query.month) || new Date().getMonth() + 1;
  const year = parseInt(req.query.year) || new Date().getFullYear();

  if (!id_user) {
    return res.status(400).json({ error: 'ID User diperlukan' });
  }

  Absensi.deleteAllByPeriod(id_user, month, year, (err, result) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({
      message: `Semua data histori periode ${month}/${year} berhasil dihapus!`,
      result,
    });
  });
};
