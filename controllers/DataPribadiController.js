const db = require('../config/db');

// Fungsi Simpan (Create)
exports.createKaryawan = (req, res) => {
    const data = req.body;
    const query = `INSERT INTO data_pribadi (id_user, nik, nip, nama_lengkap, tempat_lahir, tanggal_lahir, jenis_kelamin, alamat, agama, status_perkawinan, kewarganegaraan, jabatan, divisi, status_karyawan, jenjang_pendidikan, institusi, jurusan, tahun_lulus) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
    const values = [data.id_user, data.nik, data.nip, data.nama_lengkap, data.tempat_lahir, data.tanggal_lahir, data.jenis_kelamin, data.alamat, data.agama, data.status_perkawinan, data.kewarganegaraan, data.jabatan, data.divisi, data.status_karyawan, data.jenjang_pendidikan, data.institusi, data.jurusan, data.tahun_lulus];

    db.query(query, values, (err) => {
        if (err) return res.status(500).json({ message: "DB Error: " + err.message });
        res.status(201).json({ message: "Data berhasil disimpan!" });
    });
};

// --- FUNGSI UPDATE (PASTIIN ADA BIAR GAK ERROR LAGI) ---
exports.updateKaryawan = (req, res) => {
    const { id } = req.params;
    const d = req.body;
    const query = `UPDATE data_pribadi SET nik=?, nip=?, nama_lengkap=?, tempat_lahir=?, tanggal_lahir=?, jenis_kelamin=?, alamat=?, agama=?, status_perkawinan=?, kewarganegaraan=?, jabatan=?, divisi=?, status_karyawan=?, jenjang_pendidikan=?, institusi=?, jurusan=?, tahun_lulus=? WHERE id_user=?`;

    const values = [d.nik, d.nip, d.nama_lengkap, d.tempat_lahir, d.tanggal_lahir, d.jenis_kelamin, d.alamat, d.agama, d.status_perkawinan, d.kewarganegaraan, d.jabatan, d.divisi, d.status_karyawan, d.jenjang_pendidikan, d.institusi, d.jurusan, d.tahun_lulus, id];

    db.query(query, values, (err) => {
        if (err) return res.status(500).json({ message: "Gagal Update: " + err.message });
        res.json({ message: "Data berhasil diupdate!" });
    });
};

exports.getKaryawanById = (req, res) => {
    const { id } = req.params;
    db.query('SELECT * FROM data_pribadi WHERE id_user = ?', [id], (err, results) => {
        if (err) return res.status(500).json({ message: err.message });
        if (results.length === 0) return res.status(404).json({ message: "Data tidak ditemukan" });
        res.json(results[0]);
    });
};

exports.getAllKaryawan = (req, res) => {
    db.query('SELECT * FROM data_pribadi', (err, results) => {
        if (err) return res.status(500).json({ message: err.message });
        res.json(results);
    });
};