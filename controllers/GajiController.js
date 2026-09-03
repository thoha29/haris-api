const Gaji = require('../models/GajiModel');
const db = require('../config/db');
const ExcelJS = require('exceljs');
const { param } = require('../routes/gajiRoutes');

// 1. Fungsi untuk Proses Gaji & SPPD (Double Insert)
exports.prosesGajiLengkap = async (req, res) => {
  const {
    id_user,
    periode_bulan,
    periode_tahun,
    id_skemagaji,
    gaji_pokok,
    tunjangan_jabatan,
    uang_makan_transport: uang_sppd_manual,
    nomor_sppd,
    tujuan,
    tanggal_mulai,
    tanggal_selesai,
  } = req.body;

  try {
    // STEP 1: Ambil data absensi bulan tersebut
    Gaji.ambilDataLemburAbsensi(
      id_user,
      periode_bulan,
      periode_tahun,
      (err, resAbsensi) => {
        if (err) return res.status(500).json({ error: err.message });

        const totalHariMasuk = resAbsensi[0]?.total_hari_masuk || 0;
        const totalHariAlpha = resAbsensi[0]?.total_hari_alpha || 0;
        const totalJamLembur = parseFloat(resAbsensi[0]?.total_jam_lembur || 0);
        const totalJamTelat = parseFloat(
          ((resAbsensi[0]?.total_menit_telat || 0) / 60).toFixed(2)
        );
        const totalJamKerja = parseFloat(resAbsensi[0]?.total_jam_kerja || 0);

        // STEP 2: Ambil data skema gaji (jika ada id_skemagaji)
        const fetchSkema = (callback) => {
          if (id_skemagaji) {
            db.query(
              'SELECT * FROM skema_gaji WHERE id_skemagaji = ?',
              [id_skemagaji],
              (errSkema, resSkema) => {
                if (errSkema || resSkema.length === 0) return callback(null);
                callback(resSkema[0]);
              }
            );
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
            gajiPenuh =
              parseFloat(skema.gaji_bulanan) || parseFloat(gaji_pokok) || 0;
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
          const potonganTerlambat = Math.round(
            totalJamTelat * tarifPotonganTelatPerJam
          );
          const potonganAlpha = Math.round(totalHariAlpha * tarifPotonganAlpha);

          let ketDinas = 'Tidak ada dinas luar';

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
              tanggal_mulai,
              tanggal_selesai,
              total_hari: diffDays,
              status_sppd: 'approved',
              keterangan: `Input via Payroll Rp ${nominalSPPD.toLocaleString(
                'id-ID'
              )}`,
            };

            const sqlSppd = 'INSERT INTO sppd SET ?';
            db.query(sqlSppd, dataSPPD, (errSppd) => {
              if (errSppd)
                console.error('Gagal simpan ke tabel sppd:', errSppd.message);
            });
          }

          const bpjs = pokok * 0.01;
          const bruto = pokok + tunjangan + insentifLembur + uangMakanTransport;
          const pph21 = (bruto - 4500000) * 0.05;
          const pajak = pph21 > 0 ? pph21 : 0;

          const totalPotongan =
            bpjs + pajak + potonganTerlambat + potonganAlpha;
          const gajiBersih = bruto - totalPotongan;

          // Keterangan otomatis
          const ketSkema = skema
            ? `Golongan: ${skema.nama_golongan} | Hadir ${totalHariMasuk}/${hariKerjaPerBulan} hari`
            : `Hadir ${totalHariMasuk} hari`;
          const keterangan =
            ketDinas !== 'Tidak ada dinas luar'
              ? `${ketSkema} | ${ketDinas}`
              : ketSkema;

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
            status_bayar: 'pending',
          };

          Gaji.simpanSlipGaji(dataFinal, (errSave) => {
            if (errSave)
              return res.status(500).json({ error: errSave.message });
            res.json({
              message: 'Gaji & SPPD Berhasil Dicatat!',
              data: {
                ...dataFinal,
                keterangan,
                gaji_penuh: gajiPenuh,
                hari_kerja_per_bulan: hariKerjaPerBulan,
                nama_golongan: skema?.nama_golongan || '-',
              },
            });
          });
        });
      }
    );
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

  Gaji.updateStatusGaji(
    id_slip,
    status_bayar,
    tanggal_dibayar,
    (err, results) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json({
        message: 'Status gaji berhasil diperbarui!',
        id_slip,
        status_bayar,
        tanggal_dibayar,
      });
    }
  );
};

// 5. Fungsi untuk menghapus data gaji
exports.deleteSlipGaji = (req, res) => {
  const { id_slip } = req.params;
  Gaji.deleteSlipGaji(id_slip, (err, results) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ message: 'Data gaji berhasil dihapus!' });
  });
};

// 6. Ambil hasil proses gaji di HRD
exports.getListGaji = (req, res) => {
  Gaji.getListGaji((err, results) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(results);
  });
};

// 7. Ambil gaji perKaryawan by id
exports.getGajiKaryawanById = async (req, res) => {
  try {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({
        success: false,
        message: 'ID karyawan wajib diisi',
      });
    }

    const result = await Gaji.getGajiKaryawanById(id);

    if (!result || result.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Data karyawan tidak ditemukan',
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Data berhasil diambil',
      data: result,
    });
  } catch (error) {
    console.error('Error getGajiKaryawanById:', error);

    return res.status(500).json({
      success: false,
      message: 'Terjadi kesalahan server',
      error: error.message,
    });
  }
};

// 8. Export Excel Daftar Gaji
exports.exportExcelDaftarGaji = (req, res) => {
  Gaji.getListGaji(async (err, results) => {
    if (err) return res.status(500).json({ error: err.message });

    try {
      const workbook = new ExcelJS.Workbook();
      workbook.creator = 'HRD System';
      workbook.created = new Date();
      const worksheet = workbook.addWorksheet('Daftar Gaji');

      // Title & Subtitle
      worksheet.mergeCells('A1:Z1');
      const titleCell = worksheet.getCell('A1');
      titleCell.value = 'DAFTAR GAJI KARYAWAN';
      titleCell.font = { name: 'Calibri', size: 16, bold: true, color: { argb: '1F4E78' } };
      titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
      worksheet.getRow(1).height = 28;

      worksheet.mergeCells('A2:Z2');
      const subtitleCell = worksheet.getCell('A2');
      const todayFormatted = new Date().toLocaleDateString('id-ID', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      });
      subtitleCell.value = `Tanggal Cetak: ${todayFormatted}`;
      subtitleCell.font = { name: 'Calibri', size: 10, italic: true, color: { argb: '555555' } };
      subtitleCell.alignment = { horizontal: 'center', vertical: 'middle' };
      worksheet.getRow(2).height = 18;

      worksheet.getRow(3).height = 10;

      // Table Header Rows (Row 4 & 5)
      const cols = [
        'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J',
        'K', 'L', 'M', 'N', 'O', 'P', 'Q', 'R', 'S', 'T',
        'U', 'V', 'W', 'X', 'Y', 'Z'
      ];

      cols.forEach((col) => {
        [4, 5].forEach((rowNum) => {
          const cell = worksheet.getCell(`${col}${rowNum}`);
          cell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: '2980B9' },
          };
          cell.font = { name: 'Calibri', bold: true, color: { argb: 'FFFFFF' }, size: 9 };
          cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
          cell.border = {
            top: { style: 'thin', color: { argb: 'FFFFFF' } },
            left: { style: 'thin', color: { argb: 'FFFFFF' } },
            bottom: { style: 'thin', color: { argb: 'FFFFFF' } },
            right: { style: 'thin', color: { argb: 'FFFFFF' } },
          };
        });
      });

      worksheet.getRow(4).height = 24;
      worksheet.getRow(5).height = 24;

      // Row 4 labels & merges
      worksheet.getCell('A4').value = 'No';
      worksheet.mergeCells('A4:A5');

      worksheet.getCell('B4').value = 'Karyawan';
      worksheet.mergeCells('B4:B5');

      worksheet.getCell('C4').value = 'Upah Yang Dibayarkan';
      worksheet.mergeCells('C4:E4');

      worksheet.getCell('F4').value = 'Status Perkawinan';
      worksheet.mergeCells('F4:F5');

      worksheet.getCell('G4').value = 'Kehadiran';
      worksheet.mergeCells('G4:N4');

      worksheet.getCell('O4').value = 'Lembur';
      worksheet.mergeCells('O4:S4');

      worksheet.getCell('T4').value = 'Potongan';
      worksheet.mergeCells('T4:V4');

      worksheet.getCell('W4').value = 'Upah Dinas';
      worksheet.mergeCells('W4:Z4');

      // Row 5 sub-labels
      worksheet.getCell('C5').value = 'UP';
      worksheet.getCell('D5').value = 'TAUP';
      worksheet.getCell('E5').value = 'Total';

      worksheet.getCell('G5').value = 'Pagi';
      worksheet.getCell('H5').value = 'Malam';
      worksheet.getCell('I5').value = 'HK';
      worksheet.getCell('J5').value = 'Tunj Kehadiran';
      worksheet.getCell('K5').value = 'Premi Shift';
      worksheet.getCell('L5').value = 'KJK';
      worksheet.getCell('M5').value = 'Extra Fooding';
      worksheet.getCell('N5').value = 'Total Tunj';

      worksheet.getCell('O5').value = 'Jam';
      worksheet.getCell('P5').value = 'Hari';
      worksheet.getCell('Q5').value = 'Upah';
      worksheet.getCell('R5').value = 'Makan';
      worksheet.getCell('S5').value = 'Total';

      worksheet.getCell('T5').value = 'JHT';
      worksheet.getCell('U5').value = 'JP';
      worksheet.getCell('V5').value = 'JKes';

      worksheet.getCell('W5').value = 'Harian';
      worksheet.getCell('X5').value = 'Pagi';
      worksheet.getCell('Y5').value = 'Siang';
      worksheet.getCell('Z5').value = 'Malam';

      // Widths
      const colWidths = {
        A: 6,
        B: 24,
        C: 15,
        D: 15,
        E: 16,
        F: 14,
        G: 9,
        H: 9,
        I: 9,
        J: 16,
        K: 16,
        L: 16,
        M: 14,
        N: 17,
        O: 10,
        P: 9,
        Q: 15,
        R: 15,
        S: 16,
        T: 14,
        U: 14,
        V: 14,
        W: 14,
        X: 14,
        Y: 14,
        Z: 14,
      };

      Object.entries(colWidths).forEach(([col, width]) => {
        worksheet.getColumn(col).width = width;
      });

      const startRow = 6;
      if (!results || results.length === 0) {
        worksheet.mergeCells('A6:Z6');
        const emptyCell = worksheet.getCell('A6');
        emptyCell.value = 'Tidak ada data gaji';
        emptyCell.alignment = { horizontal: 'center', vertical: 'middle' };
        worksheet.getRow(6).height = 30;
      } else {
        results.forEach((item, idx) => {
          const rowNum = startRow + idx;
          const row = worksheet.getRow(rowNum);
          row.height = 20;

          const upah = parseFloat(item.upah) || 0;
          const tunj = parseFloat(item.tunj) || 0;
          const upahTetap = parseFloat(item.upah_tetap) || (upah + tunj);

          row.getCell('A').value = idx + 1;
          row.getCell('B').value = item.nama || '-';
          row.getCell('C').value = upah;
          row.getCell('D').value = tunj;
          row.getCell('E').value = upahTetap;
          row.getCell('F').value = item.status_perkawinan || '-';
          row.getCell('G').value = parseInt(item.pagi, 10) || 0;
          row.getCell('H').value = parseInt(item.malam, 10) || 0;
          row.getCell('I').value = parseInt(item.hari, 10) || 0;
          row.getCell('J').value = parseFloat(item.tunj_kehadiran) || 0;
          row.getCell('K').value = parseFloat(item.premi_shift) || 0;
          row.getCell('L').value = parseFloat(item.kelebihan_jam_kerja) || 0;
          row.getCell('M').value = parseFloat(item.extra_fooding) || 0;
          row.getCell('N').value = parseFloat(item.total_tunjangan) || 0;
          row.getCell('O').value = parseFloat(item.jml_lembur ?? item.jml_jam_lembur ?? 0) || 0;
          row.getCell('P').value = parseInt(item.hr_lembur, 10) || 0;
          row.getCell('Q').value = parseFloat(item.upah_lembur) || 0;
          row.getCell('R').value = parseFloat(item.uang_makan_lembur) || 0;
          row.getCell('S').value = parseFloat(item.jumlah_lembur) || 0;
          row.getCell('T').value = parseFloat(item.jht) || 0;
          row.getCell('U').value = parseFloat(item.jp) || 0;
          row.getCell('V').value = parseFloat(item.jkes) || 0;
          row.getCell('W').value = parseFloat(item.uharian) || 0;
          row.getCell('X').value = parseFloat(item.upagi) || 0;
          row.getCell('Y').value = parseFloat(item.usiang) || 0;
          row.getCell('Z').value = parseFloat(item.umalam) || 0;

          // Alignments & Number formats
          row.getCell('A').alignment = { horizontal: 'center', vertical: 'middle' };
          row.getCell('B').alignment = { horizontal: 'left', vertical: 'middle' };
          row.getCell('F').alignment = { horizontal: 'center', vertical: 'middle' };

          ['G', 'H', 'I', 'P'].forEach((col) => {
            row.getCell(col).alignment = { horizontal: 'center', vertical: 'middle' };
            row.getCell(col).numFmt = '#,##0';
          });

          row.getCell('O').alignment = { horizontal: 'center', vertical: 'middle' };
          row.getCell('O').numFmt = '0.00';

          ['C', 'D', 'E', 'J', 'K', 'L', 'M', 'N', 'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z'].forEach((col) => {
            row.getCell(col).alignment = { horizontal: 'right', vertical: 'middle' };
            row.getCell(col).numFmt = '#,##0';
          });

          // Style zebra background & thin borders
          const isEven = idx % 2 === 1;
          cols.forEach((col) => {
            const cell = row.getCell(col);
            cell.font = { name: 'Calibri', size: 9 };
            if (isEven) {
              cell.fill = {
                type: 'pattern',
                pattern: 'solid',
                fgColor: { argb: 'F9FAFB' },
              };
            }
            cell.border = {
              top: { style: 'thin', color: { argb: 'E5E7EB' } },
              left: { style: 'thin', color: { argb: 'E5E7EB' } },
              bottom: { style: 'thin', color: { argb: 'E5E7EB' } },
              right: { style: 'thin', color: { argb: 'E5E7EB' } },
            };
          });
        });

        // Add TOTAL row
        const endRow = startRow + results.length - 1;
        const totalRowNum = endRow + 1;
        const totalRow = worksheet.getRow(totalRowNum);
        totalRow.height = 22;

        totalRow.getCell('A').value = 'TOTAL';
        worksheet.mergeCells(`A${totalRowNum}:B${totalRowNum}`);
        totalRow.getCell('A').alignment = { horizontal: 'center', vertical: 'middle' };
        totalRow.getCell('A').font = { name: 'Calibri', bold: true, size: 10 };

        totalRow.getCell('F').value = '';

        const sumCols = [
          { col: 'C', numFmt: '#,##0' },
          { col: 'D', numFmt: '#,##0' },
          { col: 'E', numFmt: '#,##0' },
          { col: 'G', numFmt: '#,##0' },
          { col: 'H', numFmt: '#,##0' },
          { col: 'I', numFmt: '#,##0' },
          { col: 'J', numFmt: '#,##0' },
          { col: 'K', numFmt: '#,##0' },
          { col: 'L', numFmt: '#,##0' },
          { col: 'M', numFmt: '#,##0' },
          { col: 'N', numFmt: '#,##0' },
          { col: 'O', numFmt: '0.00' },
          { col: 'P', numFmt: '#,##0' },
          { col: 'Q', numFmt: '#,##0' },
          { col: 'R', numFmt: '#,##0' },
          { col: 'S', numFmt: '#,##0' },
          { col: 'T', numFmt: '#,##0' },
          { col: 'U', numFmt: '#,##0' },
          { col: 'V', numFmt: '#,##0' },
          { col: 'W', numFmt: '#,##0' },
          { col: 'X', numFmt: '#,##0' },
          { col: 'Y', numFmt: '#,##0' },
          { col: 'Z', numFmt: '#,##0' },
        ];

        sumCols.forEach(({ col, numFmt }) => {
          const cell = totalRow.getCell(col);
          cell.value = { formula: `SUM(${col}${startRow}:${col}${endRow})` };
          cell.numFmt = numFmt;
          cell.font = { name: 'Calibri', bold: true, size: 9 };
          if (['G', 'H', 'I', 'O', 'P'].includes(col)) {
            cell.alignment = { horizontal: 'center', vertical: 'middle' };
          } else {
            cell.alignment = { horizontal: 'right', vertical: 'middle' };
          }
        });

        cols.forEach((col) => {
          const cell = totalRow.getCell(col);
          cell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'E8F4F8' },
          };
          cell.border = {
            top: { style: 'thin', color: { argb: '2980B9' } },
            left: { style: 'thin', color: { argb: 'D9D9D9' } },
            bottom: { style: 'double', color: { argb: '2980B9' } },
            right: { style: 'thin', color: { argb: 'D9D9D9' } },
          };
        });
      }

      const fileName = `Daftar_Gaji_Karyawan_${new Date().toISOString().slice(0, 10)}.xlsx`;
      res.setHeader(
        'Content-Type',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      );
      res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);

      await workbook.xlsx.write(res);
      res.end();
    } catch (excelErr) {
      console.error('Error generating Excel Daftar Gaji:', excelErr);
      if (!res.headersSent) {
        res.status(500).json({ error: 'Gagal membuat file Excel: ' + excelErr.message });
      }
    }
  });
};

