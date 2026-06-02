const Cuti = require("../models/CutiModel");
const ExcelJS = require('exceljs');

// 1. Karyawan: Ajukan Cuti
exports.ajukanCuti = (req, res) => {
    const { id_user, tipe } = req.body;
    if (!tipe || !id_user) return res.status(400).json({ error: "Data tidak lengkap." });

    Cuti.create(req.body, (err) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ message: `${tipe} berhasil diajukan!` });
    });
};

// 2. Karyawan: Riwayat Pribadi
exports.getStatusCuti = (req, res) => {
    Cuti.getByUserId(req.params.id_user, (err, results) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(results);
    });
};

// 3. Karyawan: Cek Sisa Cuti (SINKRON: Total, Terpakai, Sisa)
exports.cekSisaCuti = (req, res) => {
    Cuti.getSisaCuti(req.params.id_user, (err, result) => {
        if (err) return res.status(500).json({ error: err.message });

        // Mengirimkan objek lengkap ke frontend agar kartu informasi sinkron
        res.json({
            total_jatah: result.total_jatah,
            terpakai: result.terpakai,
            sisa_cuti: result.sisa_cuti
        });
    });
};

// 4. Approval Tahap 1: Atasan (User)
exports.getPendingUser = (req, res) => {
    Cuti.getAllForUser((err, results) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(results);
    });
};

exports.approveCutiByUser = (req, res) => {
    const { id_cuti, status } = req.body;
    Cuti.updateStatusUser(id_cuti, status, (err) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ message: `Status Atasan diupdate: ${status}` });
    });
};

// 5. Approval Tahap 2: HRD
exports.getPendingHRD = (req, res) => {
    Cuti.getAllForHRD((err, results) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(results);
    });
};

exports.approveCutiByHRD = (req, res) => {
    const { id_cuti, status } = req.body;
    Cuti.updateStatusHRD(id_cuti, status, (err) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ message: `Status Final HRD diupdate: ${status}` });
    });
};

// 6. Monitoring: Semua Data
exports.getSemuaCuti = (req, res) => {
    Cuti.getAll((err, results) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(results);
    });
};

// 7. Laporan Excel Global
exports.exportCutiExcel = (req, res) => {
    Cuti.getAll((err, results) => {
        if (err) return res.status(500).json({ error: err.message });

        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Laporan Cuti');

        worksheet.columns = [
            { header: 'Nama Karyawan', key: 'nama_karyawan', width: 20 },
            { header: 'Tipe', key: 'tipe', width: 15 },
            { header: 'Mulai', key: 'tanggal_mulai', width: 15 },
            { header: 'Selesai', key: 'tanggal_selesai', width: 15 },
            { header: 'Alasan', key: 'alasan', width: 30 },
            { header: 'Status Final', key: 'status', width: 15 }
        ];

        worksheet.addRows(results);

        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', 'attachment; filename=Laporan_Cuti_PT_BSS.xlsx');

        workbook.xlsx.write(res).then(() => res.end());
    });
};

// 8. Laporan Excel Per User (Riwayat Detail)
exports.exportCutiExcelPerUser = (req, res) => {
    const { id_user } = req.params;
    Cuti.getByUserId(id_user, async (err, results) => {
        if (err) return res.status(500).json({ error: err.message });

        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Riwayat Personal');

        worksheet.columns = [
            { header: 'Tanggal Pengajuan', key: 'created_at', width: 20 },
            { header: 'Tipe', key: 'tipe', width: 15 },
            { header: 'Mulai', key: 'tanggal_mulai', width: 15 },
            { header: 'Selesai', key: 'tanggal_selesai', width: 15 },
            { header: 'Alasan', key: 'alasan', width: 30 },
            { header: 'Status', key: 'status', width: 15 }
        ];

        worksheet.addRows(results);

        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename=Riwayat_Cuti_User_${id_user}.xlsx`);

        await workbook.xlsx.write(res);
        res.end();
    });
};