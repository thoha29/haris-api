const Jadwal = require("../models/JadwalModel");

/**
 * Helper resolution function to identify target user IDs from request body.
 * Supports:
 * - target_all / target_all_karyawan / all_karyawan = true or id_user / id_users = 'all': all users with role (default: 'karyawan')
 * - id_users = [1, 2, 3] or id_user = [1, 2, 3]: specific selected user IDs ("beberapa karyawan saja")
 * - id_user = 5: single user ID
 */
const resolveTargetUserIds = (body, callback) => {
    const { id_user, id_users, target_all, target_all_karyawan, all_karyawan, target_role, role } = body;

    const isTargetAll = target_all === true || 
                        target_all === 'true' || 
                        target_all_karyawan === true || 
                        target_all_karyawan === 'true' || 
                        all_karyawan === true || 
                        all_karyawan === 'true' || 
                        id_user === 'all' || 
                        id_users === 'all';

    if (isTargetAll) {
        const roleToQuery = target_role || (role && role !== 'all' ? role : null) || 'karyawan';
        return Jadwal.getUsersByRole(roleToQuery, (err, userIds) => {
            if (err) return callback(err);
            if (!userIds || userIds.length === 0) {
                return callback(new Error(`Tidak ada user yang ditemukan dengan role '${roleToQuery}'`));
            }
            callback(null, userIds);
        });
    }

    if (Array.isArray(id_users) && id_users.length > 0) {
        return callback(null, id_users);
    }

    if (Array.isArray(id_user) && id_user.length > 0) {
        return callback(null, id_user);
    }

    if (id_user && id_user !== 'all') {
        return callback(null, [id_user]);
    }

    return callback(new Error("Data tidak lengkap: Parameter target karyawan (id_user / id_users / target_all) tidak ditemukan!"));
};

// 1. Ambil daftar karyawan (untuk dropdown kalender)
exports.listJadwal = (req, res) => {
    Jadwal.getKaryawanJadwal((err, results) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(results);
    });
};

// 2. Plotting jadwal baru (Mendukung 1 karyawan, beberapa karyawan, atau seluruh karyawan dengan role 'karyawan')
exports.setJadwal = (req, res) => {
    const { id_skema, tanggal, tanggalArray } = req.body;

    if (!id_skema) {
        return res.status(400).json({ error: "Data tidak lengkap: id_skema wajib diisi!" });
    }

    let dates = [];
    if (Array.isArray(tanggalArray) && tanggalArray.length > 0) {
        dates = tanggalArray;
    } else if (Array.isArray(tanggal) && tanggal.length > 0) {
        dates = tanggal;
    } else if (tanggal) {
        dates = [tanggal];
    } else {
        return res.status(400).json({ error: "Data tidak lengkap: tanggal / tanggalArray wajib diisi!" });
    }

    resolveTargetUserIds(req.body, (err, userIds) => {
        if (err) return res.status(400).json({ error: err.message });

        const values = [];
        for (const uid of userIds) {
            for (const d of dates) {
                values.push([uid, id_skema, d]);
            }
        }

        Jadwal.assignJadwalBulk(values, (err, result) => {
            if (err) return res.status(500).json({ error: err.message });

            let message = "Jadwal berhasil di-plot!";
            if (userIds.length > 1) {
                message = `Berhasil mem-plot ${dates.length} hari jadwal untuk ${userIds.length} karyawan!`;
            } else if (dates.length > 1) {
                message = `Berhasil mem-plot ${dates.length} hari jadwal!`;
            }

            res.json({
                message,
                total_assigned: values.length,
                total_karyawan: userIds.length,
                total_hari: dates.length,
                affectedRows: result ? result.affectedRows : 0
            });
        });
    });
};

// 2b. Plotting jadwal untuk rentang tanggal (bulk)
exports.setJadwalBulk = exports.setJadwal;

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

// 6. [FITUR BARU] Hapus shift dari kalender (Mendukung 1 karyawan, beberapa karyawan, atau seluruh karyawan)
exports.deleteJadwal = (req, res) => {
    const { tanggal, tanggalArray } = req.body;

    let dates = [];
    if (Array.isArray(tanggalArray) && tanggalArray.length > 0) {
        dates = tanggalArray;
    } else if (Array.isArray(tanggal) && tanggal.length > 0) {
        dates = tanggal;
    } else if (tanggal) {
        dates = [tanggal];
    } else {
        return res.status(400).json({ error: "Data tidak lengkap: tanggal / tanggalArray dibutuhkan" });
    }

    resolveTargetUserIds(req.body, (err, userIds) => {
        if (err) return res.status(400).json({ error: err.message });

        Jadwal.deleteJadwalBulk(userIds, dates, (err, result) => {
            if (err) return res.status(500).json({ error: err.message });
            if (result.affectedRows === 0) return res.status(404).json({ error: "Jadwal shift tidak ditemukan" });
            res.json({
                message: `Berhasil menghapus jadwal shift untuk ${result.affectedRows} data!`,
                affectedRows: result.affectedRows
            });
        });
    });
};

// 7. [FITUR BARU] Hapus shift untuk banyak hari sekaligus
exports.deleteJadwalBulk = exports.deleteJadwal;
