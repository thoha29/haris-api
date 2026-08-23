const db = require('../config/db');

async function runMigration() {
  console.log('Starting migration for master_komponen_rab & rab_detail...');

  // 1. master_komponen_rab
  db.query(`SHOW COLUMNS FROM master_komponen_rab LIKE 'tipe_komponen'`, (err, rows) => {
    if (err) {
      console.error('Error checking master_komponen_rab:', err);
      process.exit(1);
    }

    if (rows.length === 0) {
      db.query(`
        ALTER TABLE master_komponen_rab 
        ADD COLUMN tipe_komponen ENUM('harian', 'sekali') NOT NULL DEFAULT 'harian' AFTER satuan
      `, (err2) => {
        if (err2) console.error('Error adding tipe_komponen:', err2);
        else console.log('Successfully added tipe_komponen to master_komponen_rab');
        checkRabDetail();
      });
    } else {
      console.log('tipe_komponen already exists in master_komponen_rab');
      checkRabDetail();
    }
  });

  function checkRabDetail() {
    db.query(`SHOW COLUMNS FROM rab_detail`, (err, cols) => {
      if (err) {
        console.error('Error checking rab_detail:', err);
        process.exit(1);
      }

      const colNames = cols.map(c => c.Field);

      const alters = [];
      if (!colNames.includes('tanggal')) {
        alters.push(`ADD COLUMN tanggal DATE NULL AFTER id_komponen`);
      }
      if (!colNames.includes('tipe_komponen')) {
        alters.push(`ADD COLUMN tipe_komponen ENUM('harian', 'sekali') NOT NULL DEFAULT 'harian' AFTER tanggal`);
      }
      if (!colNames.includes('jumlah')) {
        alters.push(`ADD COLUMN jumlah INT NOT NULL DEFAULT 1 AFTER tipe_komponen`);
      }
      if (!colNames.includes('keterangan')) {
        alters.push(`ADD COLUMN keterangan VARCHAR(255) NULL AFTER total`);
      }

      if (alters.length > 0) {
        const sql = `ALTER TABLE rab_detail ${alters.join(', ')}`;
        db.query(sql, (err2) => {
          if (err2) console.error('Error altering rab_detail:', err2);
          else console.log('Successfully altered rab_detail with:', alters.join(', '));
          finish();
        });
      } else {
        console.log('All columns already exist in rab_detail');
        finish();
      }
    });
  }

  function finish() {
    console.log('Migration finished successfully!');
    process.exit(0);
  }
}

runMigration();
