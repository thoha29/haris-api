const db = require('../config/db');

async function runMigration() {
  try {
    const [colsSppd] = await db.query("SHOW COLUMNS FROM sppd LIKE 'status_karyawan'");
    if (colsSppd && colsSppd.length > 0) {
      console.log('Dropping status_karyawan from sppd...');
      await db.query('ALTER TABLE sppd DROP COLUMN status_karyawan');
      console.log('Successfully dropped status_karyawan from sppd.');
    } else {
      console.log('status_karyawan already dropped.');
    }

    const [colsRab] = await db.query("SHOW COLUMNS FROM rab_detail LIKE 'total_hrd'");
    if (!colsRab || colsRab.length === 0) {
      console.log('Adding hrd columns to rab_detail...');
      await db.query(`
        ALTER TABLE rab_detail 
        ADD COLUMN jumlah_hrd INT(11) DEFAULT NULL AFTER total,
        ADD COLUMN harga_satuan_hrd DECIMAL(15,2) DEFAULT NULL AFTER jumlah_hrd,
        ADD COLUMN total_hrd DECIMAL(15,2) DEFAULT NULL AFTER harga_satuan_hrd
      `);
      console.log('Successfully added hrd columns to rab_detail.');
    } else {
      console.log('hrd columns already exist in rab_detail.');
    }

    console.log('Syncing existing data in rab_detail...');
    await db.query(`
      UPDATE rab_detail 
      SET jumlah_hrd = jumlah, 
          harga_satuan_hrd = harga_satuan, 
          total_hrd = total 
      WHERE jumlah_hrd IS NULL
    `);
    console.log('Data synced successfully.');

    process.exit(0);
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  }
}

runMigration();
