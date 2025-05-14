const mongoose = require('mongoose');

const gameSchema = new mongoose.Schema({
  passHistory: {
    type: Map,
    of: Number,
    default: {},
  },  
  players: [{ type: String }], // kullanıcı adları
  board: [[String]], // 15x15 matris (başta boş)
  letters: {
    type: Map,
    of: [String] // oyuncuya özel harf listesi
  },
  status: { type: String, default: 'waiting' }, // waiting, active, finished
  turn: { type: String }, // şu anki oyuncunun username'i
  duration: { type: Number }, // saniye olarak (örn: 120, 300 vs.)
  createdAt: { type: Date, default: Date.now, immutable: false },
  winner: { type: String, default: null },
  lastMoveAt: { type: Date, default: Date.now },
  consecutivePasses: { type: Number, default: 0 },
  mineMap: [[String]],
  letters: {
    type: Map,
    of: [String], // oyuncuya özel harf listesi (örnek: { yasin: ['A', 'K', ...] })
  },
  pool: [String],
  scores: {
    type: Map,
    of: Number, // oyuncu adı -> puan
    default: () => new Map()
  },
  bonusMap: {
    type: [[String]],
    default: () => Array(15).fill().map(() => Array(15).fill(null))
  },
  forbiddenLetters: {
    type: [String],
    default: []
  },
  forbiddenZones: {
    type: [[Boolean]],
    default: () => Array(15).fill().map(() => Array(15).fill(false))
  }

  
});

module.exports = mongoose.model('Game', gameSchema);
