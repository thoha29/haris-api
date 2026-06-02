const Career = require('../models/CareerModel');

exports.getCareer = (req, res) => {
    // Ambil id_user dari query string (misal: /riwayat?id_user=1)
    const id_user = req.query.id_user;

    if (!id_user) {
        return res.status(400).json({ message: "ID User tidak disertakan" });
    }

    Career.getByUserId(id_user, (err, results) => {
        if (err) return res.status(500).json({ message: "Error DB", error: err });
        res.json(results);
    });
};

exports.storeCareer = (req, res) => {
    // Ambil id_user dari body form
    const { id_user, nama_perusahaan, jabatan, tanggal_masuk, tanggal_keluar } = req.body;

    if (!id_user) return res.status(400).json({ message: "ID User wajib diisi" });
    if (!req.file) return res.status(400).json({ message: "Foto bukti kosong" });

    const newCareer = {
        id_user,
        nama_perusahaan,
        jabatan,
        tanggal_masuk,
        tanggal_keluar,
        foto_bukti: req.file.filename
    };

    Career.create(newCareer, (err, result) => {
        if (err) return res.status(500).json({ message: "Gagal simpan", error: err });
        res.status(201).json({ message: "Riwayat karier berhasil ditambahkan!" });
    });
};