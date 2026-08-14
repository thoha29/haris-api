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
 * for dates between startDateStr and endDateStr
 */
const autoGenerateNonShiftSchedule = (id_user, startDateStr, endDateStr, callback) => {
  if (!id_user || !startDateStr || !endDateStr) {
    if (callback) callback(null);
    return;
  }

  const start = new Date(startDateStr);
  const end = new Date(endDateStr);

  if (isNaN(start.getTime()) || isNaN(end.getTime()) || start > end) {
    if (callback) callback(null);
    return;
  }

  const values = [];
  let curr = new Date(start);
  while (curr <= end) {
    const year = curr.getFullYear();
    const month = String(curr.getMonth() + 1).padStart(2, '0');
    const day = String(curr.getDate()).padStart(2, '0');
    const dateStr = `${year}-${month}-${day}`;
    values.push([id_user, 6, dateStr]);
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

    console.log("BODY:", req.body);
    console.log("VALUES:", values);

    db.query(query, values, (err) => {
        if (err) {
            return res
                .status(500)
                .json({ message: 'DB Error: ' + err.message });
        }

        // Jika tipe_kerja non-shift, buatkan jadwal otomatis ke skema 6
        if (tipeKerja === 'non-shift' && d.id_user && d.tanggal_kontrak_berakhir) {
            const startDate = d.tanggal_masuk || new Date().toISOString().split('T')[0];
            autoGenerateNonShiftSchedule(d.id_user, startDate, d.tanggal_kontrak_berakhir, () => {
                return res.status(201).json({
                    message: 'Data berhasil disimpan dan jadwal non-shift (id_skema: 6) telah dibuat secara otomatis!'
                });
            });
        } else {
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

        // Jika tipe_kerja non-shift, sync jadwal otomatis
        if (tipeKerja === 'non-shift' && id && d.tanggal_kontrak_berakhir) {
            const startDate = d.tanggal_masuk || new Date().toISOString().split('T')[0];
            autoGenerateNonShiftSchedule(id, startDate, d.tanggal_kontrak_berakhir, () => {
                return res.json({
                    message: 'Data berhasil diupdate dan jadwal non-shift (id_skema: 6) disinkronkan!'
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
            u.username, u.role, u.jatah_cuti, u.id_skemagaji
        FROM data_pribadi dp
        LEFT JOIN users u ON dp.id_user = u.id_user
        WHERE dp.id_user = ? OR dp.id_data_pribadi = ?
        LIMIT 1
    `;

    db.query(
        query,
        [id, id],
        (err, results) => {
            if (err)
                return res.status(500).json({
                    message: err.message
                });

            if (results.length === 0)
                return res.status(404).json({
                    message: 'Data tidak ditemukan'
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
