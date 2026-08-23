const MasterKomponen = require('../models/MasterKomponenModel');

exports.getAll = (req, res) => {
  MasterKomponen.getAll((err, results) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(results);
  });
};

exports.getActive = (req, res) => {
  MasterKomponen.getActive((err, results) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(results);
  });
};

exports.getById = (req, res) => {
  const { id } = req.params;
  MasterKomponen.getById(id, (err, results) => {
    if (err) return res.status(500).json({ error: err.message });
    if (results.length === 0) return res.status(404).json({ message: 'Komponen tidak ditemukan' });
    res.json(results[0]);
  });
};

exports.create = (req, res) => {
  const { nama_komponen, kategori, satuan, tipe_komponen, status_komponen_rab } = req.body;
  if (!nama_komponen || !kategori || !satuan) {
    return res.status(400).json({ error: 'Nama komponen, kategori, dan satuan wajib diisi!' });
  }

  MasterKomponen.create(
    {
      nama_komponen,
      kategori,
      satuan,
      tipe_komponen: tipe_komponen || 'harian',
      status_komponen_rab: status_komponen_rab || '1',
    },
    (err, result) => {
      if (err) return res.status(500).json({ error: err.message });
      res.status(201).json({ message: 'Master komponen berhasil ditambahkan!', id: result.insertId });
    }
  );
};

exports.update = (req, res) => {
  const { id } = req.params;
  const { nama_komponen, kategori, satuan, tipe_komponen, status_komponen_rab } = req.body;
  if (!nama_komponen || !kategori || !satuan) {
    return res.status(400).json({ error: 'Nama komponen, kategori, dan satuan wajib diisi!' });
  }

  MasterKomponen.update(
    id,
    {
      nama_komponen,
      kategori,
      satuan,
      tipe_komponen: tipe_komponen || 'harian',
      status_komponen_rab: status_komponen_rab || '1',
    },
    (err, result) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ message: 'Master komponen berhasil diperbarui!' });
    }
  );
};

exports.delete = (req, res) => {
  const { id } = req.params;
  MasterKomponen.delete(id, (err, result) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ message: 'Master komponen berhasil dihapus!' });
  });
};

exports.toggleStatus = (req, res) => {
  const { id } = req.params;
  MasterKomponen.toggleStatus(id, (err, result) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ message: 'Status master komponen berhasil diubah!' });
  });
};
