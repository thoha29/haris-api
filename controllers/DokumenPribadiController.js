const DokumenPribadiModel = require('../models/DokumenPribadiModel');

exports.uploadDokumen = (req, res) => {
    // 1. Validasi file dari Multer
    if (!req.file) {
        return res.status(400).json({ message: "File kosong atau tidak valid!" });
    }

    // 2. Validasi ID User (PENTING: Agar tidak kena error Foreign Key lagi)
    if (!req.body.id_user || req.body.id_user === 'undefined') {
        return res.status(400).json({ message: "ID User tidak valid atau belum login!" });
    }

    const payload = {
        id_user: req.body.id_user,
        nama_dokumen: req.body.nama_dokumen,
        file_name: req.file.filename,
        file_path: `/uploads/dokumen/${req.file.filename}`,
        tipe_file: req.file.mimetype
    };

    console.log("DATA YANG MASUK DARI REACT:", payload);

    DokumenPribadiModel.create(payload, (err, result) => {
        if (err) {
            console.error("Database Error:", err);
            return res.status(500).json({ error: "Gagal menyimpan ke database" });
        }
        res.status(201).json({
            message: "Dokumen Berhasil Diunggah",
            id: result.insertId
        });
    });
};

exports.getByUserId = (req, res) => {
    const { id_user } = req.params;

    // Tambahkan log untuk memastikan ID yang dicari benar
    console.log("Mencari dokumen untuk User ID:", id_user);

    DokumenPribadiModel.getByUserId(id_user, (err, results) => {
        if (err) {
            console.error("Database Error:", err);
            return res.status(500).json({ error: "Gagal mengambil data dokumen" });
        }

        // Jangan kembalikan 404 jika kosong, kembalikan array kosong [] saja 
        // agar Frontend (React) tidak masuk ke blok catch/error
        res.status(200).json(results || []);
    });
};