const Absensi = require("../models/AbsensiModel");
const ExcelJS = require('exceljs');
const db = require("../config/db");

// Helper untuk menghitung selisih menit antara dua string waktu (HH:mm:ss)
const getDiffMinutes = (start, end) => {
    if (!start || !end) return 0;
    const [h1, m1] = start.split(':').map(Number);
    const [h2, m2] = end.split(':').map(Number);
    return (h2 * 60 + m2) - (h1 * 60 + m1);
};

// --- PROSES CHECK-IN (REVISI BYPASS TOTAL) ---
exports.postCheckIn = (req, res) => {
    const data = req.body;

    // Validasi dasar
    if (!data.id_user || !data.tanggal || !data.jam_masuk || !data.role) {
        return res.status(400).json({ error: "Data check-in tidak lengkap (role diperlukan)!" });
    }

    const userRole = data.role.toLowerCase();

    // 1. LOGIKA BYPASS UNTUK 'USER' & 'HRD'
    if (userRole === 'user' || userRole === 'hrd') {
        const bypassData = {
            id_user: data.id_user,
            id_skema: data.id_skema || null, // Boleh null untuk bypass
            tanggal: data.tanggal,
            jam_masuk: data.jam_masuk,
            keterlambatan: 0,
            status_user: 'approved',
            // HRD langsung approved total (Final), USER approved level 1 saja
            status_hrd: (userRole === 'hrd') ? 'approved' : 'pending'
        };

        Absensi.checkIn(bypassData, (err, result) => {
            if (err) return res.status(500).json({ error: err.message });
            return res.status(201).json({
                message: `Check-in ${userRole.toUpperCase()} berhasil (Bypass Otomatis)`
            });
        });
    }
    // 2. LOGIKA UNTUK KARYAWAN & KEUANGAN (WAJIB SKEMA)
    else {
        if (!data.id_skema) return res.status(400).json({ error: "Role ini wajib menggunakan id_skema!" });

        const sqlSkema = `SELECT jam_masuk, jam_keluar, toleransi_menit FROM skema_absensi WHERE id_skema = ?`;
        db.query(sqlSkema, [data.id_skema], (err, skemaResults) => {
            if (err) return res.status(500).json({ error: "Database error: " + err.message });
            if (skemaResults.length === 0) return res.status(404).json({ error: "Skema tidak ditemukan!" });

            const skema = skemaResults[0];
            const selisihAwal = getDiffMinutes(skema.jam_masuk, data.jam_masuk);
            const selisihAkhir = getDiffMinutes(skema.jam_keluar, data.jam_masuk);

            Absensi.checkTodayAttendance(data.id_user, data.tanggal, (err, results) => {
                if (err) return res.status(500).json({ error: err.message });
                if (results.length > 0) return res.status(400).json({ error: "Sudah absen atau ada catatan kehadiran hari ini!" });

                // JIKA LEWAT JAM KERJA -> BLOKIR DAN JADIKAN ALPHA LANGSUNG
                if (selisihAkhir >= 0) {
                    const insertAlphaQuery = `
                        INSERT INTO absensi 
                        (id_user, id_skema, tanggal, jam_masuk, jam_keluar, status, is_approved, status_user, status_hrd, keterlambatan, lembur, total_jam_kerja) 
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    `;
                    const values = [
                        data.id_user, data.id_skema, data.tanggal, '00:00:00', '00:00:00', 'Alpha', 'approved', 'approved', 'approved', 0, 0, 0.0
                    ];

                    db.query(insertAlphaQuery, values, (err) => {
                        if (err) console.error("Error insert Alpha API:", err);
                        return res.status(403).json({ error: "Shift sudah berakhir. Anda tidak dapat absen dan otomatis tercatat sebagai Alpha." });
                    });
                    return; // Stop execution
                }

                let keterlambatan = selisihAwal > skema.toleransi_menit ? selisihAwal : 0;

                const finalData = {
                    ...data,
                    keterlambatan,
                    status_user: 'pending' // Wajib nunggu approval Atasan/User
                };

                Absensi.checkIn(finalData, (err, result) => {
                    if (err) return res.status(500).json({ error: err.message });
                    res.status(201).json({
                        message: keterlambatan > 0 ? `Check-in berhasil (Terlambat ${keterlambatan} menit). Menunggu Approval.` : "Check-in berhasil (Tepat waktu). Menunggu Approval."
                    });
                });
            });
        });
    }
};

// --- PROSES CHECK-OUT (REVISI PERHITUNGAN LEMBUR) ---
exports.updateCheckOut = (req, res) => {
    const { id_user, tanggal, jam_keluar } = req.body;

    const sqlCekMasuk = `
        SELECT a.id_data_absensi, a.jam_masuk, a.id_skema, s.jam_keluar as jam_pulang_skema 
        FROM absensi a 
        LEFT JOIN skema_absensi s ON a.id_skema = s.id_skema 
        WHERE a.id_user = ? AND a.tanggal = ? AND a.jam_keluar IS NULL
        ORDER BY a.id_data_absensi DESC LIMIT 1`;

    db.query(sqlCekMasuk, [id_user, tanggal], (err, results) => {
        if (err) return res.status(500).json({ error: "DB Error: " + err.message });
        if (results.length === 0) return res.status(400).json({ error: "Anda belum absen masuk hari ini!" });

        const dataAbsen = results[0];

        // Hitung lembur hanya jika ada skema (Bypass untuk USER/HRD tanpa skema)
        let lembur = 0;
        if (dataAbsen.jam_pulang_skema) {
            const selisihKeluar = getDiffMinutes(dataAbsen.jam_pulang_skema, jam_keluar);
            // Konversi dari menit ke jam, bulatkan 1 desimal (e.g., 90 menit -> 1.5 jam)
            lembur = selisihKeluar > 0 ? Number((selisihKeluar / 60).toFixed(1)) : 0;
        }

        const totalMenitKerja = getDiffMinutes(dataAbsen.jam_masuk, jam_keluar);
        const jam = Math.floor(totalMenitKerja / 60);
        const menit = totalMenitKerja % 60;
        const totalJamKerjaFormatted = `${jam} jam ${menit} menit`;

        Absensi.checkOut(id_user, tanggal, jam_keluar, lembur, totalJamKerjaFormatted, (err, result) => {
            if (err) return res.status(500).json({ error: err.message });
            res.json({
                message: `Check-out berhasil!`,
                durasi: totalJamKerjaFormatted,
                lembur: lembur > 0 ? `${lembur} jam` : '0'
            });
        });
    });
};

// --- APPROVAL TAHAP 1: USER / ATASAN ---
exports.approveByUser = (req, res) => {
    const { id_data_absensi, status } = req.body;
    if (!id_data_absensi) return res.status(400).json({ error: "ID Absensi tidak ditemukan!" });

    Absensi.updateStatusUser(id_data_absensi, status, (err, result) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({
            message: status === 'rejected' ? "Absensi ditolak (Final)" : "Disetujui User, menunggu verifikasi HRD"
        });
    });
};

// --- APPROVAL TAHAP 2: HRD ---
exports.approveByHRD = (req, res) => {
    const { id_data_absensi, status } = req.body;
    if (!id_data_absensi) return res.status(400).json({ error: "ID Absensi tidak ditemukan!" });

    Absensi.updateStatusHRD(id_data_absensi, status, (err, result) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ message: `Keputusan final HRD: ${status}` });
    });
};

// --- MONITORING & RIWAYAT ---
exports.getPendingUser = (req, res) => {
    Absensi.getPendingForUser((err, results) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(results);
    });
};

exports.getPendingHRD = (req, res) => {
    Absensi.getPendingForHRD((err, results) => {
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
            { header: 'Status Final', key: 'is_approved', width: 15 }
        ];

        worksheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFF' } };
        worksheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: '4F81BD' } };

        results.forEach(item => {
            worksheet.addRow({
                tanggal: new Date(item.tanggal).toLocaleDateString('id-ID'),
                jam_masuk: item.jam_masuk,
                jam_keluar: item.jam_keluar || '--:--',
                total_jam_kerja: item.total_jam_kerja || '0 jam 0 menit',
                keterlambatan: item.keterlambatan || 0,
                lembur: item.lembur || 0,
                is_approved: item.is_approved
            });
        });

        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename=Riwayat_Absensi_${id_user}.xlsx`);
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
    const { jam_masuk, jam_keluar, total_jam_kerja, keterlambatan, lembur, status, status_hrd, is_approved } = req.body;

    if (!id_data_absensi) {
        return res.status(400).json({ error: "ID Data Absensi diperlukan" });
    }

    const dataUpdate = {
        jam_masuk: jam_masuk || '',
        jam_keluar: jam_keluar || null,
        total_jam_kerja: total_jam_kerja || '0 jam 0 menit',
        keterlambatan: keterlambatan || 0,
        lembur: lembur || 0,
        status: status || 'Hadir',
        status_hrd: status_hrd || 'pending',
        is_approved: is_approved || 'pending'
    };

    Absensi.updateAbsensiByHRD(id_data_absensi, dataUpdate, (err, result) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ message: "Data absensi berhasil diperbarui oleh HRD!" });
    });
};