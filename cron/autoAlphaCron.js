const cron = require('node-cron');
const db = require('../config/db');

// Fungsi untuk mengeksekusi pengecekan Alpha
const checkAndInsertAlpha = () => {
    // Ambil jadwal yang BELUM mendapat record absensi di hari H atau hari-hari sebelumnya
    const queryJadwal = `
        SELECT jk.id_user, jk.id_skema, jk.tanggal, s.jam_keluar
        FROM jadwal_karyawan jk
        JOIN skema_absensi s ON jk.id_skema = s.id_skema
        LEFT JOIN absensi a ON jk.id_user = a.id_user AND jk.tanggal = a.tanggal
        WHERE a.id_data_absensi IS NULL 
          AND jk.tanggal = CURRENT_DATE()
          AND LOWER(s.nama_skema) != 'libur'
          AND s.jam_keluar IS NOT NULL
          AND s.jam_keluar != ''
    `;

    db.query(queryJadwal, (err, jadwalResults) => {
        if (err) {
            console.error('[CRON Alpha] Error mengambil data jadwal:', err);
            return;
        }

        if (jadwalResults.length === 0) {
            // console.log('[CRON Alpha] Semua jadwal sudah diabsen atau belum waktunya.');
            return; // Hening untuk log per menit
        }

        const today = new Date();
        const todayDayOnly = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
        const currentMinutes = today.getHours() * 60 + today.getMinutes();

        jadwalResults.forEach((jadwal) => {
            if (!jadwal.jam_keluar) return;

            const scheduleDate = new Date(jadwal.tanggal);
            const scheduleDayOnly = new Date(scheduleDate.getFullYear(), scheduleDate.getMonth(), scheduleDate.getDate()).getTime();

            let isShiftEnded = false;

            if (scheduleDayOnly < todayDayOnly) {
                // Shift di hari kemarin-kemarin -> pasti terlewat -> ALPHA
                isShiftEnded = true;
            } else if (scheduleDayOnly === todayDayOnly) {
                // Shift hari ini -> cek jam nya
                const [jam, menit] = jadwal.jam_keluar.split(':').map(Number);
                const jamKeluarInMinutes = jam * 60 + menit;

                if (currentMinutes >= jamKeluarInMinutes) {
                    isShiftEnded = true;
                }
            }

            if (isShiftEnded) {
                const insertAlphaQuery = `
                    INSERT INTO absensi 
                    (id_user, id_skema, tanggal, jam_masuk, jam_keluar, status, is_approved, status_user, status_hrd, keterlambatan, lembur, total_jam_kerja) 
                    SELECT ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
                    FROM DUAL
                    WHERE NOT EXISTS (
                        SELECT 1 FROM absensi 
                        WHERE id_user = ? AND tanggal = ?
                    )
                `;

                // Set format tanggal MySQL "YYYY-MM-DD"
                const dateIso = new Date(scheduleDate.getTime() - scheduleDate.getTimezoneOffset() * 60000).toISOString().split('T')[0];

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
                    jadwal.id_user, // Untuk param WHERE NOT EXISTS
                    dateIso         // Untuk param WHERE NOT EXISTS
                ];

                db.query(insertAlphaQuery, values, (err, result) => {
                    if (err) {
                        console.error('[CRON Alpha] Error insert data Alpha untuk user:', jadwal.id_user, err);
                    } else {
                        console.log('- [CRON Alpha] Shift Terlewati (Otomatis Alpha) -> User ID:', jadwal.id_user, '| Tanggal:', dateIso);
                    }
                });
            }
        });
    });
};

// Menjadwalkan eksekusi setiap menit
function initAutoAlphaCron() {
    cron.schedule('* * * * *', () => {
        checkAndInsertAlpha();
    }, {
        scheduled: true,
        timezone: "Asia/Jakarta" // Sesuaikan dengan zona waktu server
    });
    console.log('[CRON Alpha] Schedule auto-alpha diinisialisasi (Berjalan setiap menit).');
}

module.exports = {
    initAutoAlphaCron,
    checkAndInsertAlpha // Diexport untuk bisa ditest manual jika diperlukan
};
