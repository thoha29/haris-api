const db = require('../config/db');

const MasterKomponen = {
  getAll: (callback) => {
    const sql = `SELECT * FROM master_komponen_rab ORDER BY kategori ASC, nama_komponen ASC`;
    db.query(sql, callback);
  },

  getActive: (callback) => {
    const sql = `SELECT * FROM master_komponen_rab WHERE status_komponen_rab = '1' ORDER BY kategori ASC, nama_komponen ASC`;
    db.query(sql, callback);
  },

  getById: (id, callback) => {
    const sql = `SELECT * FROM master_komponen_rab WHERE id = ?`;
    db.query(sql, [id], callback);
  },

  create: (data, callback) => {
    const sql = `
      INSERT INTO master_komponen_rab (nama_komponen, kategori, satuan, tipe_komponen, status_komponen_rab)
      VALUES (?, ?, ?, ?, ?)
    `;
    db.query(
      sql,
      [
        data.nama_komponen,
        data.kategori,
        data.satuan,
        data.tipe_komponen || 'harian',
        data.status_komponen_rab || '1',
      ],
      callback
    );
  },

  update: (id, data, callback) => {
    const sql = `
      UPDATE master_komponen_rab 
      SET nama_komponen = ?, kategori = ?, satuan = ?, tipe_komponen = ?, status_komponen_rab = ?
      WHERE id = ?
    `;
    db.query(
      sql,
      [
        data.nama_komponen,
        data.kategori,
        data.satuan,
        data.tipe_komponen || 'harian',
        data.status_komponen_rab,
        id,
      ],
      callback
    );
  },

  delete: (id, callback) => {
    const sql = `DELETE FROM master_komponen_rab WHERE id = ?`;
    db.query(sql, [id], callback);
  },

  toggleStatus: (id, callback) => {
    const sql = `
      UPDATE master_komponen_rab 
      SET status_komponen_rab = IF(status_komponen_rab = '1', '0', '1')
      WHERE id = ?
    `;
    db.query(sql, [id], callback);
  },
};

module.exports = MasterKomponen;
