const cron = require('node-cron');
const db = require('../config/db');

const checkAndInsertAlpha = async () => {
  try {
    const queryJadwal = `
      SELECT jk.id_user, jk.id_skema, jk.tanggal, s.jam_keluar
      FROM jadwal_karyawan jk
      JOIN skema_absensi s ON jk.id_skema = s.id_skema
      LEFT JOIN absensi a 
        ON jk.id_user = a.id_user 
        AND jk.tanggal = a.tanggal
      WHERE a.id_data_absensi IS NULL 
        AND jk.tanggal = CURRENT_DATE()
        AND LOWER(s.nama_skema) != 'libur'
        AND LOWER(s.nama_skema) != 'dinas'
        AND LOWER(s.nama_skema) != 'off'
        AND s.jam_keluar IS NOT NULL
        AND s.jam_keluar != ''
        AND s.jam_keluar != '00:00:00'
    `;

    const [jadwalResults] = await db.query(queryJadwal);

    if (jadwalResults.length === 0) return;

    const now = new Date();
    const todayOnly = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate()
    ).getTime();

    const currentMinutes = now.getHours() * 60 + now.getMinutes();

    for (const jadwal of jadwalResults) {
      if (!jadwal.jam_keluar) continue;

      const scheduleDate = new Date(jadwal.tanggal);
      const scheduleOnly = new Date(
        scheduleDate.getFullYear(),
        scheduleDate.getMonth(),
        scheduleDate.getDate()
      ).getTime();

      let isShiftEnded = false;

      if (scheduleOnly < todayOnly) {
        isShiftEnded = true;
      } else if (scheduleOnly === todayOnly) {
        const [jam, menit] = jadwal.jam_keluar.split(':').map(Number);
        const jamKeluarMinutes = jam * 60 + menit;

        if (currentMinutes >= jamKeluarMinutes) {
          isShiftEnded = true;
        }
      }

      if (!isShiftEnded) continue;

      const dateIso = new Date(
        scheduleDate.getTime() - scheduleDate.getTimezoneOffset() * 60000
      )
        .toISOString()
        .split('T')[0];

      const insertQuery = `
        INSERT INTO absensi 
        (id_user, id_skema, tanggal, jam_masuk, jam_keluar, status, is_approved, status_user, status_hrd, keterlambatan, lembur, total_jam_kerja) 
        SELECT ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
        FROM DUAL
        WHERE NOT EXISTS (
          SELECT 1 FROM absensi 
          WHERE id_user = ? AND tanggal = ?
        )
      `;

      const values = [
        jadwal.id_user,
        jadwal.id_skema,
        dateIso,
        '00:00:00',
        '00:00:00',
        'Alpha',
        'approved',
        'approved',
        'approved',
        0,
        0,
        0.0,
        jadwal.id_user,
        dateIso,
      ];

      await db.query(insertQuery, values);

      console.log(
        '[CRON Alpha] AUTO ALPHA -> User:',
        jadwal.id_user,
        '| Tanggal:',
        dateIso
      );
    }
  } catch (err) {
    console.error('[CRON Alpha] Error:', err);
  }
};

let isRunning = false;

function initAutoAlphaCron() {
  cron.schedule('* * * * *', async () => {
    if (isRunning) return; // 🚫 skip kalau masih jalan

    isRunning = true;
    try {
      await checkAndInsertAlpha();
    } finally {
      isRunning = false;
    }
  });

  console.log('[CRON Alpha] Schedule auto-alpha diinisialisasi.');
}

module.exports = {
  initAutoAlphaCron,
  checkAndInsertAlpha,
};
