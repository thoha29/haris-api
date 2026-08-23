const db = require('../config/db');

const TransportasiPerusahaan = {
  getAll: (filter = {}, callback) => {
    let sql = `SELECT * FROM transportasi_perusahaan WHERE 1=1`;
    const params = [];

    if (filter.status) {
      sql += ` AND status = ?`;
      params.push(filter.status);
    }

    sql += ` ORDER BY nama_transportasi ASC`;
    db.query(sql, params, callback);
  },

  getById: (id, callback) => {
    const sql = `SELECT * FROM transportasi_perusahaan WHERE id = ?`;
    db.query(sql, [id], callback);
  },

  create: (data, callback) => {
    const sql = `
      INSERT INTO transportasi_perusahaan (no_transportasi, nama_transportasi, status)
      VALUES (?, ?, ?)
    `;
    db.query(sql, [data.no_transportasi, data.nama_transportasi, data.status || 'available'], callback);
  },

  update: (id, data, callback) => {
    const sql = `
      UPDATE transportasi_perusahaan 
      SET no_transportasi = ?, nama_transportasi = ?, status = ?
      WHERE id = ?
    `;
    db.query(sql, [data.no_transportasi, data.nama_transportasi, data.status || 'available', id], callback);
  },

  updateStatus: (id, status, callback) => {
    const sql = `UPDATE transportasi_perusahaan SET status = ? WHERE id = ?`;
    db.query(sql, [status, id], callback);
  },

  delete: (id, callback) => {
    const sql = `DELETE FROM transportasi_perusahaan WHERE id = ?`;
    db.query(sql, [id], callback);
  },
};

module.exports = TransportasiPerusahaan;
