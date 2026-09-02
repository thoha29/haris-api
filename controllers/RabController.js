const RabModel = require('../models/RabModel');

exports.getRabBySppdId = (req, res) => {
  const { id_sppd } = req.params;
  RabModel.getRabBySppdId(id_sppd, (err, rab) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!rab) return res.status(404).json({ message: 'RAB belum dibuat untuk SPPD ini' });
    res.json(rab);
  });
};

exports.submitRab = (req, res) => {
  const { id_sppd, details } = req.body;
  if (!id_sppd || !Array.isArray(details) || details.length === 0) {
    return res.status(400).json({ error: 'id_sppd dan rincian komponen RAB (array) wajib diisi!' });
  }

  RabModel.submitRab(id_sppd, details, (err, result) => {
    if (err) return res.status(500).json({ error: err.message });
    res.status(201).json(result);
  });
};

// ─── REVIEW OLEH ATASAN (approve / minta revisi) ─────────────────────────
exports.reviewByAtasan = (req, res) => {
  const { id_rab, action, catatan } = req.body;
  if (!id_rab || !['approve', 'revisi'].includes(action)) {
    return res.status(400).json({ error: 'id_rab dan action (approve/revisi) wajib diisi!' });
  }

  if (action === 'revisi' && (!catatan || !catatan.trim())) {
    return res.status(400).json({ error: 'Catatan revisi wajib diisi!' });
  }

  RabModel.reviewByAtasan(id_rab, action, catatan, (err, result) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(result);
  });
};

// ─── PERSETUJUAN FINAL OLEH HRD (approve only, tidak ada reject/edit) ────
exports.reviewByHrd = (req, res) => {
  const { id_rab, catatan } = req.body;
  if (!id_rab) {
    return res.status(400).json({ error: 'id_rab wajib diisi!' });
  }

  RabModel.reviewByHrd(id_rab, catatan, (err, result) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(result);
  });
};

exports.getPendingHrd = (req, res) => {
  RabModel.getAllPendingHrd((err, results) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(results);
  });
};

exports.getPendingAtasan = (req, res) => {
  RabModel.getAllPendingAtasan((err, results) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(results);
  });
};
