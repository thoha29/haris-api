const SkemaGaji = require("../models/SkemaGajiModel");

exports.getDaftarSkemaGaji = (req, res) => {
    SkemaGaji.getAll((err, results) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(results);
    });
};

exports.getSkemaGajiById = (req, res) => {
    const { id } = req.params;
    SkemaGaji.getById(id, (err, results) => {
        if (err) return res.status(500).json({ error: err.message });
        if (results.length === 0) return res.status(404).json({ message: "Skema Gaji tidak ditemukan" });
        res.json(results[0]);
    });
}

exports.tambahSkemaGaji = (req, res) => {
    let { nama_golongan, gaji_bulanan, jam_kerja_per_hari, hari_kerja_per_bulan, rate_per_jam } = req.body;
    
    // Auto-calculate rate_per_jam if not provided manually
    if (!rate_per_jam && gaji_bulanan && jam_kerja_per_hari && hari_kerja_per_bulan) {
        const totalJamSebulan = parseInt(jam_kerja_per_hari) * parseInt(hari_kerja_per_bulan);
        rate_per_jam = parseFloat(gaji_bulanan) / totalJamSebulan;
    }

    const data = {
        nama_golongan,
        gaji_bulanan: parseFloat(gaji_bulanan) || 0,
        jam_kerja_per_hari: parseInt(jam_kerja_per_hari) || 9,
        hari_kerja_per_bulan: parseInt(hari_kerja_per_bulan) || 22,
        rate_per_jam: Math.round(rate_per_jam || 0)
    };

    SkemaGaji.create(data, (err, result) => {
        if (err) return res.status(500).json({ error: err.message });
        res.status(201).json({ message: "Skema Gaji (Golongan) berhasil ditambah!" });
    });
};

exports.updateSkemaGaji = (req, res) => {
    const { id } = req.params;
    let { nama_golongan, gaji_bulanan, jam_kerja_per_hari, hari_kerja_per_bulan, rate_per_jam } = req.body;

    // Auto-calculate rate_per_jam if not provided manually
    if (!rate_per_jam && gaji_bulanan && jam_kerja_per_hari && hari_kerja_per_bulan) {
        const totalJamSebulan = parseInt(jam_kerja_per_hari) * parseInt(hari_kerja_per_bulan);
        rate_per_jam = parseFloat(gaji_bulanan) / totalJamSebulan;
    }

    const data = {
        nama_golongan,
        gaji_bulanan: parseFloat(gaji_bulanan) || 0,
        jam_kerja_per_hari: parseInt(jam_kerja_per_hari) || 9,
        hari_kerja_per_bulan: parseInt(hari_kerja_per_bulan) || 22,
        rate_per_jam: Math.round(rate_per_jam || 0)
    };

    SkemaGaji.update(id, data, (err, result) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ message: "Skema Gaji (Golongan) berhasil diupdate!" });
    });
};

exports.hapusSkemaGaji = (req, res) => {
    const { id } = req.params;
    SkemaGaji.delete(id, (err, result) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ message: "Skema Gaji (Golongan) berhasil dihapus!" });
    });
};
