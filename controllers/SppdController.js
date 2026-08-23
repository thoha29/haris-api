const SppdModel = require('../models/SppdModel');

exports.createSppd = (req, res) => {
  const data = req.body;
  const id_creator = req.user ? req.user.id_user : req.body.id_creator;

  // Auto-generate nomor_sppd if not provided or empty
  if (!data.nomor_sppd || !data.nomor_sppd.trim()) {
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    const rand = Math.floor(1000 + Math.random() * 9000);
    data.nomor_sppd = `SPPD/${yyyy}${mm}${dd}/${rand}`;
  }

  if (!data.id_user) {
    return res.status(400).json({ error: 'Karyawan yang ditugaskan wajib dipilih!' });
  }

  if (!data.alamat_tujuan || !data.alamat_tujuan.trim()) {
    return res.status(400).json({ error: 'Alamat / kota tujuan dinas wajib diisi!' });
  }

  if (!data.tanggal_mulai || !data.tanggal_selesai) {
    return res.status(400).json({ error: 'Tanggal mulai dan tanggal selesai dinas wajib diisi!' });
  }

  // Calculate total_hari if not given
  const start = new Date(data.tanggal_mulai);
  const end = new Date(data.tanggal_selesai);
  const diffTime = Math.abs(end - start);
  const total_hari = data.total_hari || Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;

  const sppdData = {
    ...data,
    id_creator,
    total_hari,
  };

  SppdModel.create(sppdData, (err, result) => {
    if (err) return res.status(500).json({ error: err.message });
    res.status(201).json({
      message: 'Surat Perjalanan Dinas (SPPD) berhasil diterbitkan!',
      id_sppd: result.insertId,
    });
  });
};

exports.getAllSppd = (req, res) => {
  const { id_user, id_creator, status_sppd, status_hrd } = req.query;
  const userRole = req.user ? req.user.role : null;
  const currentUserId = req.user ? req.user.id_user : null;

  const filter = {};

  if (userRole === 'karyawan') {
    filter.id_user = currentUserId;
  } else if (userRole === 'user') {
    if (id_creator) filter.id_creator = id_creator;
  }

  if (id_user && userRole !== 'karyawan') filter.id_user = id_user;
  if (status_sppd) filter.status_sppd = status_sppd;
  if (status_hrd) filter.status_hrd = status_hrd;

  SppdModel.getAll(filter, (err, results) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(results);
  });
};

exports.getSppdById = (req, res) => {
  const { id } = req.params;
  SppdModel.getById(id, (err, sppd) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!sppd) return res.status(404).json({ message: 'SPPD tidak ditemukan' });
    res.json(sppd);
  });
};

exports.approveByHrd = (req, res) => {
  const { id_sppd, status, catatan_hrd } = req.body;
  if (!id_sppd || !['approved', 'rejected'].includes(status)) {
    return res.status(400).json({ error: 'id_sppd dan status (approved/rejected) wajib diisi!' });
  }

  if (status === 'rejected' && (!catatan_hrd || !catatan_hrd.trim())) {
    return res.status(400).json({ error: 'Alasan penolakan wajib diisi oleh HRD!' });
  }

  SppdModel.approveByHrd(id_sppd, status, catatan_hrd, (err) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({
      message: `SPPD berhasil di-${status === 'approved' ? 'setujui' : 'tolak'} oleh HRD!`,
    });
  });
};

exports.requestCancel = (req, res) => {
  const { id_sppd, alasan_batal } = req.body;
  const id_user = req.user ? req.user.id_user : req.body.id_user;

  if (!id_sppd || !alasan_batal) {
    return res.status(400).json({ error: 'id_sppd dan alasan pembatalan wajib diisi!' });
  }

  SppdModel.requestCancel(id_sppd, id_user, alasan_batal, (err) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ message: 'Permohonan pembatalan SPPD berhasil diajukan!' });
  });
};

exports.approveCancelHrd = (req, res) => {
  const { id_sppd, status } = req.body;
  if (!id_sppd || !['approved', 'rejected'].includes(status)) {
    return res.status(400).json({ error: 'id_sppd dan status (approved/rejected) wajib diisi!' });
  }

  SppdModel.approveCancelHrd(id_sppd, status, (err) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ message: `Pembatalan SPPD ${status === 'approved' ? 'disetujui' : 'ditolak'} oleh HRD!` });
  });
};

exports.approveCancelAtasan = (req, res) => {
  const { id_sppd, status } = req.body;
  if (!id_sppd || !['approved', 'rejected'].includes(status)) {
    return res.status(400).json({ error: 'id_sppd dan status (approved/rejected) wajib diisi!' });
  }

  SppdModel.approveCancelAtasan(id_sppd, status, (err) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ message: `Pembatalan SPPD ${status === 'approved' ? 'disetujui' : 'ditolak'} oleh Atasan!` });
  });
};
