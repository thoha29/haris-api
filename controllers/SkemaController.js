const Skema = require("../models/SkemaModel");

exports.getDaftarSkema = (req, res) => {
    Skema.getAll((err, results) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(results);
    });
};

exports.tambahSkema = (req, res) => {
    const data = req.body;
    Skema.create(data, (err, result) => {
        if (err) return res.status(500).json({ error: err.message });
        res.status(201).json({ message: "Skema baru berhasil ditambah!" });
    });
};

exports.updateSkema = (req, res) => {
    const { id } = req.params;
    const data = req.body;
    Skema.update(id, data, (err, result) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ message: "Skema berhasil diupdate!" });
    });
};

exports.hapusSkema = (req, res) => {
    const { id } = req.params;
    Skema.delete(id, (err, result) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ message: "Skema berhasil dihapus!" });
    });
};