const db = require('../config/db');
const Jadwal = require('../models/JadwalModel');

// Auto-check table column tipe_kerja
db.query(
  "ALTER TABLE data_pribadi ADD COLUMN IF NOT EXISTS tipe_kerja ENUM('shift', 'non-shift') DEFAULT 'non-shift'",
  (err) => {
    if (err && err.code !== 'ER_DUP_FIELDNAME') {
      // Direct query fallback for MySQL versions where IF NOT EXISTS isn't supported in ALTER TABLE
      db.query(
        "SHOW COLUMNS FROM data_pribadi LIKE 'tipe_kerja'",
        (colErr, colRes) => {
          if (!colErr && colRes.length === 0) {
            db.query(
              "ALTER TABLE data_pribadi ADD COLUMN tipe_kerja ENUM('shift', 'non-shift') DEFAULT 'non-shift'",
              () => {}
            );
          }
        }
      );
    }
  }
);

/**
 * Helper to auto-generate non-shift schedule (id_skema: 6)
 * for dates between startDateStr and endDateStr (excluding Saturday and Sunday)
 */
const autoGenerateNonShiftSchedule = (id_user, startDateStr, endDateStr, callback) => {
  if (!id_user || !startDateStr || !endDateStr) {
    if (callback) callback(null);
    return;
  }

  // 1. Hapus jadwal lama karyawan yang dipilih terlebih dahulu
  db.query('DELETE FROM jadwal_karyawan WHERE id_user = ?', [id_user], (delErr) => {
    if (delErr) {
      console.error("Error deleting old schedule before auto-generating non-shift:", delErr);
      if (callback) return callback(delErr);
    }

    const startParts = String(startDateStr).split('T')[0].split('-');
    const endParts = String(endDateStr).split('T')[0].split('-');

    if (startParts.length !== 3 || endParts.length !== 3) {
      if (callback) callback(null);
      return;
    }

    const start = new Date(Number(startParts[0]), Number(startParts[1]) - 1, Number(startParts[2]));
    const end = new Date(Number(endParts[0]), Number(endParts[1]) - 1, Number(endParts[2]));

    if (isNaN(start.getTime()) || isNaN(end.getTime()) || start > end) {
      if (callback) callback(null);
      return;
    }

    const values = [];
    let curr = new Date(start);
    while (curr <= end) {
      const dayOfWeek = curr.getDay(); // 0 = Minggu, 6 = Sabtu
      // Kecualikan hari Sabtu (6) dan Minggu (0)
      if (dayOfWeek !== 0 && dayOfWeek !== 6) {
        const year = curr.getFullYear();
        const month = String(curr.getMonth() + 1).padStart(2, '0');
        const day = String(curr.getDate()).padStart(2, '0');
        const dateStr = `${year}-${month}-${day}`;
        values.push([id_user, 6, dateStr]);
      }
      curr.setDate(curr.getDate() + 1);
    }

    if (values.length > 0) {
      Jadwal.assignJadwalBulk(values, (err, result) => {
        if (err) console.error("Error auto-plotting non-shift schedule:", err);
        if (callback) callback(err, result);
      });
    } else {
      if (callback) callback(null);
    }
  });
};

// =======================
// CREATE
// =======================
exports.createKaryawan = (req, res) => {
    const d = req.body;
    const tipeKerja = d.tipe_kerja || 'non-shift';

    const query = `
INSERT INTO data_pribadi (
id_user,
nik,
nip,
nama_lengkap,
tempat_lahir,
tanggal_lahir,
jenis_kelamin,
alamat,
agama,
status_perkawinan,
kewarganegaraan,
jabatan,
divisi,
status_karyawan,
jenjang_pendidikan,
institusi,
jurusan,
tahun_lulus,
tanggal_masuk,
tanggal_kontrak_berakhir,
atasan_langsung,
lokasi_proyek,
nama_atasan,
lokasi_kerja,
tipe_kerja
)
VALUES (
?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
)
`;

    const values = [
      d.id_user,
      d.nik,
      d.nip,
      d.nama_lengkap,
      d.tempat_lahir,
      d.tanggal_lahir,
      d.jenis_kelamin,
      d.alamat,
      d.agama,
      d.status_perkawinan,
      d.kewarganegaraan,
      d.jabatan,
      d.divisi,
      d.status_karyawan,
      d.jenjang_pendidikan,
      d.institusi,
      d.jurusan,
      d.tahun_lulus,
      d.tanggal_masuk,
      d.tanggal_kontrak_berakhir,
      d.atasan_langsung,
      d.lokasi_proyek,
      d.nama_atasan,
      d.lokasi_kerja,
      tipeKerja
    ];

    db.query(query, values, (err) => {
        if (err) {
            return res
                .status(500)
                .json({ message: 'DB Error: ' + err.message });
        }

        // Jika tipe_kerja non-shift, buatkan jadwal otomatis ke skema 6 (kecuali sabtu & minggu)
        if (tipeKerja === 'non-shift' && d.id_user && d.tanggal_kontrak_berakhir) {
            const startDate = d.tanggal_masuk || new Date().toISOString().split('T')[0];
            autoGenerateNonShiftSchedule(d.id_user, startDate, d.tanggal_kontrak_berakhir, () => {
                return res.status(201).json({
                    message: 'Data berhasil disimpan dan jadwal non-shift (Senin-Jumat, Skema 6) telah dibuat secara otomatis!'
                });
            });
        } else {
            // Jika tipe_kerja shift, pastikan jadwal lama bersih
            if (d.id_user) {
                db.query('DELETE FROM jadwal_karyawan WHERE id_user = ?', [d.id_user], () => {});
            }
            res.status(201).json({
                message: 'Data berhasil disimpan!'
            });
        }
    });
};

// =======================
// UPDATE
// =======================
exports.updateKaryawan = (req, res) => {
    const { id } = req.params;
    const d = req.body;
    const tipeKerja = d.tipe_kerja || 'non-shift';

    const query = `
UPDATE data_pribadi
SET
nik=?,
nip=?,
nama_lengkap=?,
tempat_lahir=?,
tanggal_lahir=?,
jenis_kelamin=?,
alamat=?,
agama=?,
status_perkawinan=?,
kewarganegaraan=?,
jabatan=?,
divisi=?,
status_karyawan=?,
jenjang_pendidikan=?,
institusi=?,
jurusan=?,
tahun_lulus=?,
tanggal_masuk=?,
tanggal_kontrak_berakhir=?,
atasan_langsung=?,
nama_atasan=?,
lokasi_proyek=?,
lokasi_kerja=?,
tipe_kerja=?
WHERE id_user=?
`;

    const values = [
      d.nik,
      d.nip,
      d.nama_lengkap,
      d.tempat_lahir,
      d.tanggal_lahir,
      d.jenis_kelamin,
      d.alamat,
      d.agama,
      d.status_perkawinan,
      d.kewarganegaraan,
      d.jabatan,
      d.divisi,
      d.status_karyawan,
      d.jenjang_pendidikan,
      d.institusi,
      d.jurusan,
      d.tahun_lulus,
      d.tanggal_masuk,
      d.tanggal_kontrak_berakhir,
      d.atasan_langsung,
      d.nama_atasan,
      d.lokasi_proyek,
      d.lokasi_kerja,
      tipeKerja,
      id
    ];

    db.query(query, values, (err) => {
        if (err) {
            return res
                .status(500)
                .json({ message: 'Gagal Update: ' + err.message });
        }

        // Jika tipe_kerja non-shift, sync jadwal otomatis (hapus jadwal lama + buat Senin-Jumat skema 6)
        if (tipeKerja === 'non-shift' && id && d.tanggal_kontrak_berakhir) {
            const startDate = d.tanggal_masuk || new Date().toISOString().split('T')[0];
            autoGenerateNonShiftSchedule(id, startDate, d.tanggal_kontrak_berakhir, () => {
                return res.json({
                    message: 'Data berhasil diupdate dan jadwal non-shift (Senin-Jumat, Skema 6) telah disinkronkan!'
                });
            });
        } else if (tipeKerja === 'shift' && id) {
            // Jika berubah ke shift, hapus jadwal non-shift sebelumnya agar bersih untuk dijadwalkan shift
            db.query('DELETE FROM jadwal_karyawan WHERE id_user = ?', [id], (delErr) => {
                if (delErr) console.error("Error clearing old schedule for shift:", delErr);
                return res.json({
                    message: 'Data berhasil diupdate dan jadwal lama telah dibersihkan untuk penjadwalan shift!'
                });
            });
        } else {
            res.json({
                message: 'Data berhasil diupdate!'
            });
        }
    });
};

// =======================
// GET BY USER ID
// =======================
exports.getKaryawanById = (req, res) => {
    const { id } = req.params;

    const query = `
        SELECT 
            dp.*,
            COALESCE(dp.tipe_kerja, 'non-shift') AS tipe_kerja,
            u.id_user, u.username, u.role, u.jatah_cuti, u.id_skemagaji
        FROM users u
        LEFT JOIN data_pribadi dp ON u.id_user = dp.id_user
        WHERE u.id_user = ?
        LIMIT 1
    `;

    db.query(
        query,
        [id],
        (err, results) => {
            if (err)
                return res.status(500).json({
                    message: err.message
                });

            if (results.length === 0)
                return res.status(404).json({
                    message: 'Data user tidak ditemukan'
                });

            res.json(results[0]);
        }
    );
};

// =======================
// GET ALL
// =======================
exports.getAllKaryawan = (req, res) => {
    db.query(
        'SELECT * FROM data_pribadi',
        (err, results) => {
            if (err)
                return res.status(500).json({
                    message: err.message
                });

            res.json(results);
        }
    );
};
