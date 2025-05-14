// server.js
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const authRoutes = require('./routes/auth');
const gameRoutes = require('./routes/game');

const app = express();
const PORT = 3001;

// Middleware
app.use(cors());
app.use(express.json());

// MongoDB bağlantısı
mongoose.connect('mongodb://127.0.0.1:27017/kelime_mayinlari', {
  // Bu ayarlar yeni Mongoose sürümünde gereksiz
}).then(() => {
  console.log('✅ MongoDB bağlantısı başarılı.');
}).catch((err) => {
  console.error('❌ MongoDB bağlantı hatası:', err);
});

// Routes
app.use('/api', authRoutes);
app.use('/api', gameRoutes);

// Sunucu başlat
app.listen(PORT, () => {
  console.log(`🚀 Server http://localhost:${PORT} üzerinde çalışıyor`);
});
