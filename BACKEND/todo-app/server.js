'use strict';
const path = require('node:path');
const express = require('express');
const { DB_PATH } = require('./src/db');
const { seedIfEmpty } = require('./src/seed');
const routes = require('./src/routes');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: '100kb' }));
app.use('/api', routes);
app.use('/mockups', express.static(path.join(__dirname, 'mockups')));
app.use(express.static(path.join(__dirname, 'public')));
app.use('/public', express.static(path.join(__dirname, 'public'))); // để mockup (../public/css) chạy được qua server

const seeded = seedIfEmpty();

app.listen(PORT, () => {
  console.log(`\n  ✅ Todo app đang chạy:  http://localhost:${PORT}`);
  console.log(`  🗄️  Database:           ${DB_PATH}`);
  if (seeded) console.log(`  🌱 Lần chạy đầu tiên: đã nạp ${seeded} task mock.`);
  console.log(`  🎨 Mockup:              http://localhost:${PORT}/mockups/\n`);
});
