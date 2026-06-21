require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const absensiRoutes = require('./routes/absensiRoutes');
const cutiRoutes = require('./routes/cutiRoutes');
const karyawanRoutes = require('./routes/karyawanRoutes');
const gajiRoutes = require('./routes/gajiRoutes');
const datapribadiRoutes = require('./routes/DataPribadiRoutes');
const skemaRoutes = require('./routes/skemaRoutes');
const skemaGajiRoutes = require('./routes/skemaGajiRoutes'); // ADDED SKEMA GAJI
const jadwalRoutes = require('./routes/jadwalRoutes');
const CareerRoutes = require('./routes/careerRoutes');
const dokumenPribadiRoutes = require('./routes/DokumenPribadiRoutes');
const routes = require('./routes');

const app = express();
const port = process.env.PORT || 3000;

// --- PERBAIKAN CORS & STATIC ---
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use('/uploads', express.static(path.join(__dirname, 'public/uploads')));

// --- ROUTES ---
const { initAutoAlphaCron } = require('./cron/autoAlphaCron');

app.use(routes);
app.use('/absensi', absensiRoutes);
app.use('/cuti', cutiRoutes);
app.use('/api/karyawan', karyawanRoutes);
app.use('/payroll', gajiRoutes);
app.use('/api/data-pribadi', datapribadiRoutes);
app.use('/api/skema', skemaRoutes);
app.use('/api/skemagaji', skemaGajiRoutes); // DI REGISTER TERPISAH
app.use('/api/jadwal', jadwalRoutes);
app.use('/api/gaji', gajiRoutes);
app.use('/api/career', CareerRoutes);
app.use('/api/dokumen', dokumenPribadiRoutes);

// --- CRONS ---
initAutoAlphaCron();

app.listen(3000, () => {
  console.log('Server running on port 3000');
});
