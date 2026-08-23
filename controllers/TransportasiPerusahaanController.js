const TransportasiPerusahaan = require('../models/TransportasiPerusahaanModel');

exports.getAll = (req, res) => {
  const filter = {};
  if (req.query.status) {
    filter.status = req.query.status;
  }

  TransportasiPerusahaan.getAll(filter, (err, results) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(results);
  });
};

exports.getById = (req, res) => {
  const { id } = req.params;
  TransportasiPerusahaan.getById(id, (err, results) => {
    if (err) return res.status(500).json({ error: err.message });
    if (results.length === 0) return res.status(404).json({ message: 'Data transportasi tidak ditemukan' });
    res.json(results[0]);
  });
};

exports.create = (req, res) => {
  const { no_transportasi, nama_transportasi, status } = req.body;
  if (!no_transportasi || !nama_transportasi) {
    return res.status(400).json({ error: 'No transportasi dan nama transportasi wajib diisi!' });
  }

  TransportasiPerusahaan.create(
    { no_transportasi, nama_transportasi, status: status || 'available' },
    (err, result) => {
      if (err) return res.status(500).json({ error: err.message });
      res.status(201).json({ message: 'Transportasi perusahaan berhasil ditambahkan!', id: result.insertId });
    }
  );
};

exports.update = (req, res) => {
  const { id } = req.params;
  const { no_transportasi, nama_transportasi, status } = req.body;
  if (!no_transportasi || !nama_transportasi) {
    return res.status(400).json({ error: 'No transportasi dan nama transportasi wajib diisi!' });
  }

  TransportasiPerusahaan.update(
    id,
    { no_transportasi, nama_transportasi, status: status || 'available' },
    (err, result) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ message: 'Transportasi perusahaan berhasil diperbarui!' });
    }
  );
};

exports.updateStatus = (req, res) => {
  const { id } = req.params;
  const { status } = req.body;
  if (!status || !['available', 'occupied'].includes(status)) {
    return res.status(400).json({ error: 'Status harus bernilai available atau occupied!' });
  }

  TransportasiPerusahaan.updateStatus(id, status, (err, result) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ message: 'Status transportasi perusahaan berhasil diperbarui!' });
  });
};

exports.delete = (req, res) => {
  const { id } = req.params;
  TransportasiPerusahaan.delete(id, (err, result) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ message: 'Transportasi perusahaan berhasil dihapus!' });
  });
};
