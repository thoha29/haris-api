const Karyawan = require('../models/KaryawanModel');
const bcrypt = require('bcrypt');

exports.getKaryawan = (req, res) => {
    Karyawan.getAll((err, data) => {
        if (err) return res.status(500).json({ message: err.message });
        res.status(200).json(data);
    });
};

exports.tambahKaryawan = (req, res) => {
    const { username, password, role } = req.body;

    // Pakai bcrypt callback
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