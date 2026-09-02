const Karyawan = require('../models/KaryawanModel');
const bcrypt = require('bcrypt');
const db = require('../config/db');
const ExcelJS = require('exceljs');

exports.getKaryawan = (req, res) => {
    Karyawan.getAll((err, data) => {
        if (err) return res.status(500).json({ message: err.message });
        res.status(200).json(data);
    });
};

exports.tambahKaryawan = (req, res) => {
    const { username, password, role } = req.body;

    bcrypt.hash(password, 10, (err, hashedPassword) => {
        if (err) return res.status(500).json({ message: "Gagal enkripsi" });

        Karyawan.create({ username, password: hashedPassword, role }, (err, result) => {
            if (err) return res.status(500).json({ message: "Gagal tambah data" });
            res.status(201).json({ message: "Karyawan berhasil ditambahkan" });
        });
    });
};

exports.updateKaryawan = (req, res) => {
    const { username, password, role } = req.body;

    const executeUpdate = (hashedPwd = null) => {
        let dataToUpdate = { username, role };
        if (hashedPwd) dataToUpdate.password = hashedPwd;

        Karyawan.update(req.params.id, dataToUpdate, (err, result) => {
            if (err) return res.status(500).json({ message: err.message });
            res.json({ message: "Data berhasil diupdate" });
        });
    };

    if (password) {
        bcrypt.hash(password, 10, (err, hash) => {
            if (err) return res.status(500).json({ message: "Gagal hash" });
            executeUpdate(hash);
        });
    } else {
        executeUpdate();
    }
};

exports.hapusKaryawan = (req, res) => {
    Karyawan.delete(req.params.id, (err, result) => {
        if (err) return res.status(500).json({ message: err.message });
        res.json({ message: "Karyawan dihapus" });
    });
};

// ==========================================
// 1. GET LIST KARYAWAN DARI VIEW v_listKaryawan
// ==========================================
exports.getVListKaryawan = (req, res) => {
    const queryView = 'SELECT * FROM v_listKaryawan';
    const queryFallback = `
        SELECT 
            dp.id_data_pribadi, dp.id_user, dp.nik, dp.nip, dp.nama_lengkap, 
            dp.tempat_lahir, dp.tanggal_lahir, dp.jenis_kelamin, dp.alamat, dp.agama, 
            dp.status_perkawinan, dp.kewarganegaraan, dp.jabatan, dp.divisi, 
            dp.status_karyawan, dp.jenjang_pendidikan, dp.institusi, dp.jurusan, 
            dp.tahun_lulus, dp.no_hp, dp.email, dp.foto, dp.tanggal_masuk, 
            dp.tanggal_kontrak_berakhir, dp.atasan_langsung, dp.lokasi_proyek, 
            dp.nama_atasan, dp.lokasi_kerja, COALESCE(dp.tipe_kerja, 'non-shift') AS tipe_kerja, 
            u.username, u.role, u.jatah_cuti, u.id_skemagaji
        FROM data_pribadi dp
        LEFT JOIN users u ON dp.id_user = u.id_user
        ORDER BY dp.id_data_pribadi DESC
    `;

    db.query(queryView, (err, results) => {
        if (err) {
            console.warn('[V_LIST_KARYAWAN] View query failed, using fallback query:', err.message);
            db.query(queryFallback, (fallbackErr, fallbackResults) => {
                if (fallbackErr) return res.status(500).json({ message: fallbackErr.message });
                res.json(fallbackResults);
            });
        } else {
            res.json(results);
        }
    });
};

// Helper format date for Excel
const formatDateExcel = (val) => {
    if (!val) return '-';
    try {
        const d = new Date(val);
        if (isNaN(d.getTime())) return String(val);
        return d.toISOString().split('T')[0];
    } catch {
        return String(val);
    }
};

// ==========================================
// 2. EXPORT EXCEL SEMUA KARYAWAN
// ==========================================
exports.exportExcelAll = (req, res) => {
    const query = 'SELECT * FROM v_listKaryawan';

    db.query(query, async (err, results) => {
        if (err) return res.status(500).json({ message: 'DB Error: ' + err.message });

        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Data Karyawan');

        worksheet.columns = [
            { header: 'ID Data Pribadi', key: 'id_data_pribadi', width: 15 },
            { header: 'ID User', key: 'id_user', width: 10 },
            { header: 'Username', key: 'username', width: 15 },
            { header: 'NIK', key: 'nik', width: 18 },
            { header: 'NIP', key: 'nip', width: 18 },
            { header: 'Nama Lengkap', key: 'nama_lengkap', width: 25 },
            { header: 'Tipe Kerja', key: 'tipe_kerja', width: 12 },
            { header: 'Jabatan', key: 'jabatan', width: 20 },
            { header: 'Divisi', key: 'divisi', width: 18 },
            { header: 'Status Karyawan', key: 'status_karyawan', width: 18 },
            { header: 'Tanggal Masuk', key: 'tanggal_masuk', width: 15 },
            { header: 'Kontrak Berakhir', key: 'tanggal_kontrak_berakhir', width: 18 },
            { header: 'Tempat Lahir', key: 'tempat_lahir', width: 18 },
            { header: 'Tanggal Lahir', key: 'tanggal_lahir', width: 15 },
            { header: 'Jenis Kelamin', key: 'jenis_kelamin', width: 15 },
            { header: 'Agama', key: 'agama', width: 12 },
            { header: 'Status Perkawinan', key: 'status_perkawinan', width: 18 },
            { header: 'Kewarganegaraan', key: 'kewarganegaraan', width: 18 },
            { header: 'Alamat', key: 'alamat', width: 30 },
            { header: 'Jenjang Pendidikan', key: 'jenjang_pendidikan', width: 20 },
            { header: 'Institusi', key: 'institusi', width: 20 },
            { header: 'Jurusan', key: 'jurusan', width: 20 },
            { header: 'Tahun Lulus', key: 'tahun_lulus', width: 12 },
            { header: 'No HP', key: 'no_hp', width: 16 },
            { header: 'Email', key: 'email', width: 25 },
            { header: 'Atasan Langsung', key: 'atasan_langsung', width: 20 },
            { header: 'Nama Atasan', key: 'nama_atasan', width: 20 },
            { header: 'Lokasi Proyek', key: 'lokasi_proyek', width: 20 },
            { header: 'Lokasi Kerja', key: 'lokasi_kerja', width: 20 },
            { header: 'Role System', key: 'role', width: 15 },
            { header: 'Jatah Cuti', key: 'jatah_cuti', width: 12 },
            { header: 'ID Skema Gaji', key: 'id_skemagaji', width: 15 }
        ];

        // Format header row style
        worksheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFF' } };
        worksheet.getRow(1).fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: '1F4E78' }
        };

        const rowsFormatted = results.map((row) => ({
            ...row,
            tanggal_masuk: formatDateExcel(row.tanggal_masuk),
            tanggal_kontrak_berakhir: formatDateExcel(row.tanggal_kontrak_berakhir),
            tanggal_lahir: formatDateExcel(row.tanggal_lahir),
            jenis_kelamin: row.jenis_kelamin === 'L' ? 'Laki-laki' : row.jenis_kelamin === 'P' ? 'Perempuan' : row.jenis_kelamin
        }));

        worksheet.addRows(rowsFormatted);

        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', 'attachment; filename=Data_Keseluruhan_Karyawan.xlsx');

        await workbook.xlsx.write(res);
        res.end();
    });
};

// ==========================================
// 3. EXPORT EXCEL DETAIL 1 KARYAWAN
// ==========================================
exports.exportExcelDetail = (req, res) => {
    const { id } = req.params;

    const queryView = 'SELECT * FROM v_listKaryawan WHERE id_user = ? LIMIT 1';
    const queryFallback = `
        SELECT 
            dp.id_data_pribadi, dp.id_user, dp.nik, dp.nip, dp.nama_lengkap, 
            dp.tempat_lahir, dp.tanggal_lahir, dp.jenis_kelamin, dp.alamat, dp.agama, 
            dp.status_perkawinan, dp.kewarganegaraan, dp.jabatan, dp.divisi, 
            dp.status_karyawan, dp.jenjang_pendidikan, dp.institusi, dp.jurusan, 
            dp.tahun_lulus, dp.no_hp, dp.email, dp.foto, dp.tanggal_masuk, 
            dp.tanggal_kontrak_berakhir, dp.atasan_langsung, dp.lokasi_proyek, 
            dp.nama_atasan, dp.lokasi_kerja, COALESCE(dp.tipe_kerja, 'non-shift') AS tipe_kerja, 
            u.username, u.role, u.jatah_cuti, u.id_skemagaji
        FROM data_pribadi dp
        LEFT JOIN users u ON dp.id_user = u.id_user
        WHERE dp.id_user = ?
        LIMIT 1
    `;

    const generateExcel = async (results) => {
        if (!results || results.length === 0) {
            return res.status(404).json({ message: 'Data karyawan tidak ditemukan' });
        }

        const k = results[0];
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Data Pribadi');

        // Header Title Banner
        worksheet.mergeCells('A1:B1');
        const titleCell = worksheet.getCell('A1');
        titleCell.value = 'BIODATA / DATA PRIBADI KARYAWAN';
        titleCell.font = { bold: true, size: 14, color: { argb: 'FFFFFF' } };
        titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
        titleCell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: '1F4E78' }
        };
        worksheet.getRow(1).height = 30;

        worksheet.mergeCells('A2:B2');
        const subtitleCell = worksheet.getCell('A2');
        subtitleCell.value = `PT. BANGGAI SENTRAL SULAWESI - Dicetak: ${new Date().toLocaleDateString('id-ID')}`;
        subtitleCell.font = { italic: true, size: 10, color: { argb: '555555' } };
        subtitleCell.alignment = { horizontal: 'center', vertical: 'middle' };
        worksheet.getRow(2).height = 20;

        // Table Header
        worksheet.getRow(4).values = ['Field Informasi', 'Keterangan / Nilai'];
        worksheet.getRow(4).font = { bold: true, color: { argb: 'FFFFFF' } };
        worksheet.getRow(4).fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: '2F5597' }
        };
        worksheet.getRow(4).height = 24;

        worksheet.getColumn(1).width = 30;
        worksheet.getColumn(2).width = 50;

        const detailRows = [
            // Identitas Pribadi
            ['NIK', k.nik || '-'],
            ['Nama Lengkap', k.nama_lengkap || '-'],
            ['Tempat Lahir', k.tempat_lahir || '-'],
            ['Tanggal Lahir', formatDateExcel(k.tanggal_lahir)],
            ['Jenis Kelamin', k.jenis_kelamin === 'L' ? 'Laki-laki' : k.jenis_kelamin === 'P' ? 'Perempuan' : k.jenis_kelamin || '-'],
            ['Agama', k.agama || '-'],
            ['Status Perkawinan', k.status_perkawinan || '-'],
            ['Kewarganegaraan', k.kewarganegaraan || '-'],
            ['Alamat Lengkap', k.alamat || '-'],

            // Kepegawaian
            ['NIP', k.nip || '-'],
            ['Jabatan', k.jabatan || '-'],
            ['Divisi', k.divisi || '-'],
            ['Status Karyawan', k.status_karyawan ? k.status_karyawan.toUpperCase() : '-'],
            ['Tipe Kerja', k.tipe_kerja ? k.tipe_kerja.toUpperCase() : 'NON-SHIFT'],
            ['Tanggal Masuk', formatDateExcel(k.tanggal_masuk)],
            ['Tanggal Kontrak Berakhir', formatDateExcel(k.tanggal_kontrak_berakhir)],
            ['Lokasi Kerja', k.lokasi_kerja || '-'],
            ['Lokasi Proyek', k.lokasi_proyek || '-'],
            ['Atasan Langsung', k.atasan_langsung || '-'],
            ['Nama Atasan', k.nama_atasan || '-'],

            // Pendidikan & Kontak
            ['Jenjang Pendidikan', k.jenjang_pendidikan || '-'],
            ['Institusi / Universitas', k.institusi || '-'],
            ['Jurusan', k.jurusan || '-'],
            ['Tahun Lulus', k.tahun_lulus ? String(k.tahun_lulus) : '-'],
            ['Nomor HP / WhatsApp', k.no_hp || '-'],
            ['Email', k.email || '-'],

            // Sistem Info
            ['Username Sistem', k.username || '-'],
            ['Role Sistem', k.role || '-'],
            ['Jatah Cuti', k.jatah_cuti !== undefined ? `${k.jatah_cuti} Hari` : '-']
        ];

        detailRows.forEach((row, index) => {
            const addedRow = worksheet.addRow(row);
            addedRow.height = 20;
            // Alternate row background
            if (index % 2 === 1) {
                addedRow.fill = {
                    type: 'pattern',
                    pattern: 'solid',
                    fgColor: { argb: 'F2F4F7' }
                };
            }
            addedRow.eachCell((cell) => {
                cell.border = {
                    top: { style: 'thin', color: { argb: 'D3D3D3' } },
                    left: { style: 'thin', color: { argb: 'D3D3D3' } },
                    bottom: { style: 'thin', color: { argb: 'D3D3D3' } },
                    right: { style: 'thin', color: { argb: 'D3D3D3' } }
                };
                cell.alignment = { vertical: 'middle' };
            });
        });

        const safeName = (k.nama_lengkap || k.username || 'Karyawan').replace(/[^a-zA-Z0-9]/g, '_');
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename=Data_Pribadi_${safeName}.xlsx`);

        await workbook.xlsx.write(res);
        res.end();
    };

    db.query(queryView, [id, id], (err, results) => {
        if (err) {
            console.warn('[EXPORT_EXCEL_DETAIL] View query failed, using fallback query:', err.message);
            db.query(queryFallback, [id, id], (fallbackErr, fallbackResults) => {
                if (fallbackErr) return res.status(500).json({ message: fallbackErr.message });
                generateExcel(fallbackResults);
            });
        } else {
            generateExcel(results);
        }
    });
};