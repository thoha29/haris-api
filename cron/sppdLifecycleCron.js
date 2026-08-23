const cron = require('node-cron');
const db = require('../config/db');

const checkAndTransitionSppd = async () => {
  try {
    const todayStr = new Date().toISOString().split('T')[0];

    // 1. Check SPPD reaching start date
    const queryStartingSppd = `
      SELECT s.*, r.status AS status_rab
      FROM sppd s
      LEFT JOIN rab r ON s.id_sppd = r.id_sppd
      WHERE s.status_sppd IN ('approved', 'pending')
        AND s.tanggal_mulai <= CURRENT_DATE()
    `;

    const [sppdList] = await db.query(queryStartingSppd);

    for (const sppd of sppdList) {
      if (sppd.status_sppd === 'approved' && sppd.status_rab === 'approved') {
        if (sppd.tanggal_selesai >= todayStr) {
          await db.query(`UPDATE sppd SET status_sppd = 'active' WHERE id_sppd = ?`, [sppd.id_sppd]);
          if (sppd.transportasi_perusahaan) {
            await db.query(`UPDATE transportasi_perusahaan SET status = 'occupied' WHERE id = ?`, [sppd.transportasi_perusahaan]);
          }
          console.log(`[SPPD CRON] SPPD ID ${sppd.id_sppd} (${sppd.nomor_sppd}) transitioned to ACTIVE`);
        } else {
          await db.query(`UPDATE sppd SET status_sppd = 'completed' WHERE id_sppd = ?`, [sppd.id_sppd]);
          if (sppd.transportasi_perusahaan) {
            await db.query(`UPDATE transportasi_perusahaan SET status = 'available' WHERE id = ?`, [sppd.transportasi_perusahaan]);
          }
          console.log(`[SPPD CRON] SPPD ID ${sppd.id_sppd} (${sppd.nomor_sppd}) transitioned to COMPLETED`);
        }
      } else {
        // Not approved or RAB not approved by start date -> Cancel
        await db.query(`UPDATE sppd SET status_sppd = 'cancelled' WHERE id_sppd = ?`, [sppd.id_sppd]);
        if (sppd.transportasi_perusahaan) {
          await db.query(`UPDATE transportasi_perusahaan SET status = 'available' WHERE id = ?`, [sppd.transportasi_perusahaan]);
        }
        console.log(`[SPPD CRON] SPPD ID ${sppd.id_sppd} (${sppd.nomor_sppd}) CANCELLED (RAB not approved by start date)`);

        // Revert schedule to default non-shift
        const [settingRows] = await db.query(`SELECT id_skema FROM pengaturan_skema WHERE key_setting = 'skema_non_shift'`);
        const idSkemaNonShift = settingRows && settingRows.length > 0 ? settingRows[0].id_skema : 6;

        const dates = [];
        const start = new Date(sppd.tanggal_mulai);
        const end = new Date(sppd.tanggal_selesai);
        const cur = new Date(start);

        while (cur <= end) {
          dates.push(cur.toISOString().split('T')[0]);
          cur.setDate(cur.getDate() + 1);
        }

        if (dates.length > 0) {
          const values = dates.map((d) => [sppd.id_user, idSkemaNonShift, d]);
          await db.query(
            `INSERT INTO jadwal_karyawan (id_user, id_skema, tanggal) VALUES ? ON DUPLICATE KEY UPDATE id_skema = VALUES(id_skema)`,
            [values]
          );
        }
      }
    }

    // 2. Check active SPPD reaching end date (transition to completed & free vehicles)
    const [activeEndingList] = await db.query(
      `SELECT id_sppd, transportasi_perusahaan FROM sppd WHERE status_sppd = 'active' AND tanggal_selesai < CURRENT_DATE()`
    );

    if (activeEndingList && activeEndingList.length > 0) {
      for (const item of activeEndingList) {
        if (item.transportasi_perusahaan) {
          await db.query(`UPDATE transportasi_perusahaan SET status = 'available' WHERE id = ?`, [item.transportasi_perusahaan]);
        }
      }
      await db.query(
        `UPDATE sppd SET status_sppd = 'completed' WHERE status_sppd = 'active' AND tanggal_selesai < CURRENT_DATE()`
      );
      console.log(`[SPPD CRON] ${activeEndingList.length} SPPD transitioned to COMPLETED and vehicles freed.`);
    }
  } catch (err) {
    console.error('[SPPD CRON] Error:', err);
  }
};

let isRunning = false;

function initSppdLifecycleCron() {
  // Run every 10 minutes or on startup
  cron.schedule('*/10 * * * *', async () => {
    if (isRunning) return;
    isRunning = true;
    try {
      await checkAndTransitionSppd();
    } finally {
      isRunning = false;
    }
  });

  // Run initial check on server startup
  checkAndTransitionSppd();

  console.log('[SPPD CRON] Schedule lifecycle SPPD diinisialisasi.');
}

module.exports = {
  initSppdLifecycleCron,
  checkAndTransitionSppd,
};
