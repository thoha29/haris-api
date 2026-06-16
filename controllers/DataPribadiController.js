const db = require('../config/db');

// =======================
// CREATE
// =======================
exports.createKaryawan = (req, res) => {
    const d = req.body;

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
lokasi_kerja
)
VALUES (
?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
)
`;

const values = [
data.id_user,
data.nik,
data.nip,
data.nama_lengkap,
data.tempat_lahir,
data.tanggal_lahir,
data.jenis_kelamin,
data.alamat,
data.agama,
data.status_perkawinan,
data.kewarganegaraan,
data.jabatan,
data.divisi,
data.status_karyawan,
data.jenjang_pendidikan,
data.institusi,
data.jurusan,
data.tahun_lulus,

data.tanggal_masuk,
data.tanggal_kontrak_berakhir,
data.atasan_langsung,
data.lokasi_kerja
];

    db.query(query, values, (err) => {
        if (err) {
            return res
                .status(500)
                .json({ message: 'DB Error: ' + err.message });
        }

        res.status(201).json({
            message: 'Data berhasil disimpan!'
        });
    });
};

// =======================
// UPDATE
// =======================
exports.updateKaryawan = (req, res) => {
    const { id } = req.params;
    const d = req.body;

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
lokasi_kerja=?
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

id
];

    db.query(query, values, (err) => {
        if (err) {
            return res
                .status(500)
                .json({ message: 'Gagal Update: ' + err.message });
        }

        res.json({
            message: 'Data berhasil diupdate!'
        });
    });
};

// =======================
// GET BY USER ID
// =======================
exports.getKaryawanById = (req, res) => {
    const { id } = req.params;

    db.query(
        'SELECT * FROM data_pribadi WHERE id_user = ?',
        [id],
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
