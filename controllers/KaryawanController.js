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

    const query = 'SELECT * FROM v_listKaryawan WHERE id_user = ? OR id_data_pribadi = ? LIMIT 1';

    db.query(query, [id, id], async (err, results) => {
        if (err) return res.status(500).json({ message: 'DB Error: ' + err.message });
        if (results.length === 0) return res.status(404).json({ message: 'Data karyawan tidak ditemukan' });

        const k = results[0];
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Detail Karyawan');

        worksheet.columns = [
            { header: 'Field Informasi', key: 'field', width: 30 },
            { header: 'Nilai / Data', key: 'value', width: 45 }
        ];

        worksheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFF' } };
        worksheet.getRow(1).fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: '1F4E78' }
        };

        const detailRows = [
            { field: 'ID Data Pribadi', value: k.id_data_pribadi },
            { field: 'ID User', value: k.id_user },
            { field: 'Username', value: k.username || '-' },
            { field: 'NIK', value: k.nik || '-' },
            { field: 'NIP', value: k.nip || '-' },
            { field: 'Nama Lengkap', value: k.nama_lengkap || '-' },
            { field: 'Tipe Kerja', value: k.tipe_kerja ? k.tipe_kerja.toUpperCase() : 'NON-SHIFT' },
            { field: 'Jabatan', value: k.jabatan || '-' },
            { field: 'Divisi', value: k.divisi || '-' },
            { field: 'Status Karyawan', value: k.status_karyawan || '-' },
            { field: 'Tanggal Masuk', value: formatDateExcel(k.tanggal_masuk) },
            { field: 'Tanggal Kontrak Berakhir', value: formatDateExcel(k.tanggal_kontrak_berakhir) },
            { field: 'Tempat Lahir', value: k.tempat_lahir || '-' },
            { field: 'Tanggal Lahir', value: formatDateExcel(k.tanggal_lahir) },
            { field: 'Jenis Kelamin', value: k.jenis_kelamin === 'L' ? 'Laki-laki' : k.jenis_kelamin === 'P' ? 'Perempuan' : k.jenis_kelamin || '-' },
            { field: 'Agama', value: k.agama || '-' },
            { field: 'Status Perkawinan', value: k.status_perkawinan || '-' },
            { field: 'Kewarganegaraan', value: k.kewarganegaraan || '-' },
            { field: 'Alamat', value: k.alamat || '-' },
            { field: 'Jenjang Pendidikan', value: k.jenjang_pendidikan || '-' },
            { field: 'Institusi', value: k.institusi || '-' },
            { field: 'Jurusan', value: k.jurusan || '-' },
            { field: 'Tahun Lulus', value: k.tahun_lulus || '-' },
            { field: 'No HP', value: k.no_hp || '-' },
            { field: 'Email', value: k.email || '-' },
            { field: 'Atasan Langsung', value: k.atasan_langsung || '-' },
            { field: 'Nama Atasan', value: k.nama_atasan || '-' },
            { field: 'Lokasi Proyek', value: k.lokasi_proyek || '-' },
            { field: 'Lokasi Kerja', value: k.lokasi_kerja || '-' },
            { field: 'Role System', value: k.role || '-' },
            { field: 'Jatah Cuti', value: k.jatah_cuti !== undefined ? k.jatah_cuti : '-' },
            { field: 'ID Skema Gaji', value: k.id_skemagaji || '-' }
        ];

        worksheet.addRows(detailRows);

        const safeName = (k.nama_lengkap || k.username || 'Karyawan').replace(/[^a-zA-Z0-9]/g, '_');
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename=Detail_Karyawan_${safeName}.xlsx`);

        await workbook.xlsx.write(res);
        res.end();
    });
};