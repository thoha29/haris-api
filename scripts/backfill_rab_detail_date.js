const db = require('../config/db');

console.log('Running backfill for rab_detail tanggal for once/null items...');

const sql = `
  UPDATE rab_detail rd
  JOIN rab r ON rd.id_rab = r.id
  JOIN sppd s ON r.id_sppd = s.id_sppd
  SET rd.tanggal = s.tanggal_mulai
  WHERE rd.tanggal IS NULL AND s.tanggal_mulai IS NOT NULL;
`;

db.query(sql, (err, result) => {
  if (err) {
    console.error('Error backfilling rab_detail tanggal:', err);
    process.exit(1);
  }
  console.log(`Backfill completed successfully. Changed rows: ${result.changedRows}, Affected rows: ${result.affectedRows}`);
  process.exit(0);
});
