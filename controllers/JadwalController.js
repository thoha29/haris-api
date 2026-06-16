const Jadwal = require("../models/JadwalModel");

// 1. Ambil daftar karyawan (untuk dropdown kalender)
exports.listJadwal = (req, res) => {
    Jadwal.getKaryawanJadwal((err, results) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(results);
    });
};

// 2. Plotting jadwal baru
exports.setJadwal = (req, res) => {
    const { id_user, id_skema, tanggal } = req.body;
    if (!id_user || !id_skema || !tanggal) {
        return res.status(400).json({ error: "Data tidak lengkap!" });
    }
    Jadwal.assignJadwal(id_user, id_skema, tanggal, (err, result) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ message: "Jadwal berhasil di-plot!" });
    });
};

// 2b. Plotting jadwal untuk rentang tanggal (bulk)
exports.setJadwalBulk = (req, res) => {
    const { id_user, id_skema, tanggalArray } = req.body;

    if (!id_user || !id_skema || !Array.isArray(tanggalArray) || tanggalArray.length === 0) {
        return res.status(400).json({ error: "Data tidak lengkap atau format tanggal salah!" });
    }

    // Ubah ke format array of arrays untuk query batch INSERT
    const values = tanggalArray.map(tanggal => [id_user, id_skema, tanggal]);

    Jadwal.assignJadwalBulk(values, (err, result) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ message: `Berhasil mem-plot ${tanggalArray.length} hari jadwal!` });
    });
};

// 3. Ambil riwayat jadwal user (untuk events kalender)
exports.getJadwalByUser = (req, res) => {
    const { id_user } = req.params;
    Jadwal.getJadwalByUserId(id_user, (err, results) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(results);
    });
};

// 4. Cek jadwal spesifik (untuk validasi tombol absen)
exports.checkTodaySchedule = (req, res) => {
    const { id_user } = req.params;
    const { tanggal } = req.query;
    Jadwal.getJadwalByDate(id_user, tanggal, (err, result) => {
        if (err) return res.status(500).json({ error: err.message });
        if (!result || result.length === 0) return res.status(404).json(null);
        res.json(result[0]);
    });
};

// 5. Ambil semua orang yang kerja hari ini (Monitoring Tab)
exports.getDaily = (req, res) => {
    const { tanggal } = req.query;
    if (!tanggal) return res.status(400).json({ error: "Tanggal diperlukan!" });

    Jadwal.getDailyWorkers(tanggal, (err, results) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(results);
    });
};

// 6. [FITUR BARU] Hapus shift dari kalender
exports.deleteJadwal = (req, res) => {
    const { id_user, tanggal } = req.body;
    if (!id_user || !tanggal) {
        return res.status(400).json({ error: "id_user dan tanggal dibutuhkan" });
    }

    Jadwal.deleteJadwal(id_user, tanggal, (err, result) => {
        if (err) return res.status(500).json({ error: err.message });
        if (result.affectedRows === 0) return res.status(404).json({ error: "Jadwal shift tidak ditemukan" });
        res.json({ message: "Jadwal shift berhasil dihapus!" });
    });
};

// 7. [FITUR BARU] Hapus shift untuk banyak hari sekaligus
exports.deleteJadwalBulk = (req, res) => {
    const { id_user, tanggalArray } = req.body;

    if (!id_user || !Array.isArray(tanggalArray) || tanggalArray.length === 0) {
        return res.status(400).json({ error: "Data tidak lengkap atau format tanggal salah!" });
    }

    Jadwal.deleteJadwalBulk(id_user, tanggalArray, (err, result) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ message: `Berhasil menghapus jadwal shift untuk ${result.affectedRows} hari!` });
    });
};
