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

exports.reviewByHrd = (req, res) => {
  const { id_rab, status, catatan, updatedDetails } = req.body;
  if (!id_rab || !['approved', 'rejected'].includes(status)) {
    return res.status(400).json({ error: 'id_rab dan status (approved/rejected) wajib diisi!' });
  }

  if (status === 'rejected' && (!catatan || !catatan.trim())) {
    return res.status(400).json({ error: 'Alasan penolakan wajib diisi oleh HRD!' });
  }

  RabModel.reviewByHrd(id_rab, status, catatan, updatedDetails, (err, result) => {
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
