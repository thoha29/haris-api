import db from "../config/db"; // Pastiin ini pake mysql2 atau koneksi MariaDB lu

/* CREATE DATA PRIBADI */
export const createDataPribadi = (data, callback) => {
  const query = `
    INSERT INTO data_pribadi (
      id_user, nik, nip, nama_lengkap, tempat_lahir, tanggal_lahir, 
      jenis_kelamin, alamat, agama, status_perkawinan, kewarganegaraan, 
      jabatan, divisi, status_karyawan, jenjang_pendidikan, institusi, 
      jurusan, tahun_lulus
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `;

  const values = [
    data.id_user, data.nik, data.nip, data.nama_lengkap, data.tempat_lahir,
    data.tanggal_lahir, data.jenis_kelamin, data.alamat, data.agama,
    data.status_perkawinan, data.kewarganegaraan, data.jabatan, data.divisi,
    data.status_karyawan, data.jenjang_pendidikan, data.institusi,
    data.jurusan, data.tahun_lulus
  ];

  db.query(query, values, callback);
};

/* GET ALL DATA PRIBADI */
export const getAllDataPribadi = (callback) => {
  db.query("SELECT * FROM data_pribadi", callback);
};

/* GET DATA PRIBADI BY ID USER */
export const getDataPribadiByUserId = (id_user, callback) => {
  db.query("SELECT * FROM data_pribadi WHERE id_user = ?", [id_user], callback);
};