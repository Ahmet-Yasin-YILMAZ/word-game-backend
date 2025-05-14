const express = require('express');
const router = express.Router();
const User = require('../models/User');

// Regex tanımları
const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/;

// Kayıt
router.post('/register', async (req, res) => {
  const { username, password, email } = req.body;

  // Boş alan kontrolü
  if (!username || !password || !email) {
    return res.status(400).json({ message: 'Tüm alanlar gereklidir.' });
  }

  // Validasyonlar
  if (username.length < 3) {
    return res.status(400).json({ message: 'Kullanıcı adı en az 3 karakter olmalı.' });
  }

  if (!emailRegex.test(email)) {
    return res.status(400).json({ message: 'Geçerli bir e-posta adresi giriniz.' });
  }

  if (!passwordRegex.test(password)) {
    return res.status(400).json({
      message: 'Şifre en az 8 karakter olmalı, büyük harf, küçük harf ve rakam içermeli.'
    });
  }

  const existing = await User.findOne({ username });
  if (existing) {
    return res.status(400).json({ message: 'Kullanıcı adı zaten alınmış.' });
  }

  const newUser = new User({ username, password, email });
  await newUser.save();
  res.status(201).json({ message: 'Kayıt başarılı.' });
});

// Giriş
router.post('/login', async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ message: 'Kullanıcı adı ve şifre zorunludur.' });
  }

  const user = await User.findOne({ username });
  if (!user) return res.status(400).json({ message: 'Kullanıcı bulunamadı.' });

  if (user.password !== password) return res.status(401).json({ message: 'Şifre yanlış.' });

  res.status(200).json({ message: 'Giriş başarılı.', user });
});

module.exports = router;
