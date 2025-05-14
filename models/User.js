const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  password: String, // Hash yok, direkt kayıt
  email: String,
});

module.exports = mongoose.model('User', userSchema);
