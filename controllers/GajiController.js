const Gaji = require("../models/GajiModel");
const db = require("../config/db");

// 1. Fungsi untuk Proses Gaji & SPPD (Double Insert)
exports.prosesGajiLengkap = async (req, res) => {
    const {
        id_user, periode_bulan, periode_tahun,
        id_skemagaji, gaji_pokok, tunjangan_jabatan,
        uang_makan_transport: uang_sppd_manual, nomor_sppd, tujuan, tanggal_mulai, tanggal_selesai
    } = req.body;

    try {
        // STEP 1: Ambil data absensi bulan tersebut
        Gaji.ambilDataLemburAbsensi(id_user, periode_bulan, periode_tahun, (err, resAbsensi) => {
            if (err) return res.status(500).json({ error: err.message });

            const totalHariMasuk = resAbsensi[0]?.total_hari_masuk || 0;
            const totalHariAlpha = resAbsensi[0]?.total_hari_alpha || 0;
            const totalJamLembur = parseFloat(resAbsensi[0]?.total_jam_lembur || 0);
            const totalJamTelat = parseFloat(((resAbsensi[0]?.total_menit_telat || 0) / 60).toFixed(2));
            const totalJamKerja = parseFloat(resAbsensi[0]?.total_jam_kerja || 0);

            // STEP 2: Ambil data skema gaji (jika ada id_skemagaji)
            const fetchSkema = (callback) => {
                if (id_skemagaji) {
                    db.query("SELECT * FROM skema_gaji WHERE id_skemagaji = ?", [id_skemagaji], (errSkema, resSkema) => {
                        if (errSkema || resSkema.length === 0) return callback(null);
                        callback(resSkema[0]);
                    });
                } else {
                    callback(null);
                }
            };

            fetchSkema((skema) => {
                // STEP 3: Hitung gaji_pokok berdasarkan hari hadir (prorated)
                let pokok;
                let hariKerjaPerBulan = 22; // Default
                let gajiPenuh = parseFloat(gaji_pokok) || 0;

                if (skema) {
                    hariKerjaPerBulan = parseInt(skema.hari_kerja_per_bulan) || 22;
                    gajiPenuh = parseFloat(skema.gaji_bulanan) || parseFloat(gaji_pokok) || 0;
                }

                // Prorated: Gaji Pokok = (Hari Masuk Approved / Total Hari Kerja Sebulan) * Gaji Bulanan
                pokok = Math.round((totalHariMasuk / hariKerjaPerBulan) * gajiPenuh);

                const tunjangan = parseFloat(tunjangan_jabatan) || 0;

                const tarifLemburPerJam = 20000;
                const tarifPotonganTelatPerJam = 30000;
                const tarifPotonganAlpha = 150000;

                const nominalSPPD = parseFloat(uang_sppd_manual) || 0;
                const uangMakanTransport = nominalSPPD;

                // Hitung insentif dan potongan
                const insentifLembur = Math.round(totalJamLembur * tarifLemburPerJam);
                const potonganTerlambat = Math.round(totalJamTelat * tarifPotonganTelatPerJam);
                const potonganAlpha = Math.round(totalHariAlpha * tarifPotonganAlpha);

                let ketDinas = "Tidak ada dinas luar";

                // Insert ke tabel SPPD jika ada nominal
                if (nominalSPPD > 0) {
                    const tgl1 = new Date(tanggal_mulai);
                    const tgl2 = new Date(tanggal_selesai);
                    const diffTime = Math.abs(tgl2 - tgl1);
                    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;

                    ketDinas = `Dinas Luar: ${diffDays} Hari`;

                    const dataSPPD = {
                        id_user,
                        nomor_sppd: nomor_sppd || `SPPD/AUTO/${id_user}/${Date.now()}`,
                        tujuan: tujuan || 'Dinas Luar',
                        tanggal_mulai, tanggal_selesai,
                        total_hari: diffDays,
                        status_sppd: 'approved',
                        keterangan: `Input via Payroll Rp ${nominalSPPD.toLocaleString('id-ID')}`
                    };

                    const sqlSppd = "INSERT INTO sppd SET ?";
                    db.query(sqlSppd, dataSPPD, (errSppd) => {
                        if (errSppd) console.error("Gagal simpan ke tabel sppd:", errSppd.message);
                    });
                }

                const bpjs = pokok * 0.01;
                const bruto = pokok + tunjangan + insentifLembur + uangMakanTransport;
                const pph21 = (bruto - 4500000) * 0.05;
                const pajak = pph21 > 0 ? pph21 : 0;

                const totalPotongan = bpjs + pajak + potonganTerlambat + potonganAlpha;
                const gajiBersih = bruto - totalPotongan;

                // Keterangan otomatis
                const ketSkema = skema ? `Golongan: ${skema.nama_golongan} | Hadir ${totalHariMasuk}/${hariKerjaPerBulan} hari` : `Hadir ${totalHariMasuk} hari`;
                const keterangan = ketDinas !== "Tidak ada dinas luar" ? `${ketSkema} | ${ketDinas}` : ketSkema;

                const dataFinal = {
                    id_user,
                    bulan: periode_bulan,
                    tahun: periode_tahun,
                    gaji_pokok: pokok,
                    tunjangan_jabatan: tunjangan,
                    total_hadir: totalHariMasuk,
                    total_jam_lembur: totalJamLembur,
                    total_jam_kerja: totalJamKerja,
                    total_jam_telat: totalJamTelat,
                    uang_makan_transport: uangMakanTransport,
                    insentif_lembur: insentifLembur,
                    potongan_terlambat: potonganTerlambat,
                    potongan_alpha: potonganAlpha,
                    potongan_bpjs: bpjs,
                    potongan_lain: pajak,
                    gaji_bersih: Math.round(gajiBersih),
                    status_bayar: 'pending'
                };

                Gaji.simpanSlipGaji(dataFinal, (errSave) => {
                    if (errSave) return res.status(500).json({ error: errSave.message });
                    res.json({
                        message: "Gaji & SPPD Berhasil Dicatat!",
                        data: {
                            ...dataFinal,
                            keterangan,
                            gaji_penuh: gajiPenuh,
                            hari_kerja_per_bulan: hariKerjaPerBulan,
                            nama_golongan: skema?.nama_golongan || '-'
                        }
                    });
                });
            });
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};


// 2. Fungsi untuk Ambil Riwayat Gaji
exports.getRiwayatGaji = (req, res) => {
    const { id_user } = req.params;
    Gaji.getGajiByUser(id_user, (err, results) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(results);
    });
};

// 3. Fungsi untuk Pimpinan mengambil semua data gaji
exports.getAllGaji = (req, res) => {
    Gaji.getAllGaji((err, results) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(results);
    });
};

// 4. Fungsi untuk update status gaji
exports.updateStatusGaji = (req, res) => {
    const { id_slip } = req.params;
    const { status_bayar } = req.body;
    
    // Jika status_bayar 'paid', set tanggal_dibayar jadi sekarang
    const tanggal_dibayar = status_bayar === 'paid' ? new Date() : null;

    Gaji.updateStatusGaji(id_slip, status_bayar, tanggal_dibayar, (err, results) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ message: "Status gaji berhasil diperbarui!", id_slip, status_bayar, tanggal_dibayar });
    });
};

// 5. Fungsi untuk menghapus data gaji
exports.deleteSlipGaji = (req, res) => {
    const { id_slip } = req.params;
    Gaji.deleteSlipGaji(id_slip, (err, results) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ message: "Data gaji berhasil dihapus!" });
    });
};