const PengaturanSkema = require('../models/PengaturanSkemaModel');

exports.getAllPengaturan = (req, res) => {
  PengaturanSkema.getAll((err, results) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(results);
  });
};

exports.getPengaturanByKey = (req, res) => {
  const { key } = req.params;
  PengaturanSkema.getByKey(key, (err, results) => {
    if (err) return res.status(500).json({ error: err.message });
    if (results.length === 0) {
      return res.status(404).json({ message: `Pengaturan dengan key '${key}' tidak ditemukan` });
    }
    res.json(results[0]);
  });
};

exports.updatePengaturan = (req, res) => {
  const { key_setting, id_skema, keterangan } = req.body;
  if (!key_setting || !id_skema) {
    return res.status(400).json({ error: 'key_setting dan id_skema wajib diisi!' });
  }

  PengaturanSkema.updateSetting(key_setting, id_skema, keterangan, (err, result) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ message: `Pengaturan '${key_setting}' berhasil diperbarui!`, result });
  });
};

exports.updatePengaturanBulk = (req, res) => {
  const { settings } = req.body;
  if (!Array.isArray(settings) || settings.length === 0) {
    return res.status(400).json({ error: 'Data settings harus berupa array non-empty!' });
  }

  PengaturanSkema.updateBulk(settings, (err, result) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ message: 'Pengaturan skema berhasil diperbarui!', result });
  });
};
