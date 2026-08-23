const MasterKomponen = require('../models/MasterKomponenModel');
const RabModel = require('../models/RabModel');

console.log('Testing MasterKomponen and RabModel queries...');

MasterKomponen.getAll((err, results) => {
  if (err) {
    console.error('Error MasterKomponen.getAll:', err);
    process.exit(1);
  }
  console.log(`Success! Fetched ${results.length} master components.`);
  if (results.length > 0) {
    console.log('Sample component:', results[0]);
  }
  process.exit(0);
});
