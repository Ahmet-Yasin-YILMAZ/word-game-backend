const express = require("express");
const router = express.Router();
const Game = require("../models/Game");
const { isValidWord } = require("../utils/wordValidator");
const letterPoints = require("../utils/letterPoints");
const letterPoolDef = require("../utils/letterPool");
const generateBonusMap = require("../utils/bonusMap");

// Yardımcı fonksiyonlar
function generateMineMap() {
  const map = Array(15)
    .fill()
    .map(() => Array(15).fill(null));
  const items = [
    "puan_dusur",
    "puan_transfer",
    "harf_kaybi",
    "puan_iptali",
    "hamle_engeli",
    "bolge_yasagi",
    "harf_yasagi",
    "joker_ekstra_harf",
    "joker_ekstra_hamle",
    "joker_yasak_kaldır",
  ];
  const forbiddenLetters = [];
  const forbiddenZones = Array(15)
    .fill()
    .map(() => Array(15).fill(false));

  for (let i = 0; i < 10; i++) {
    const row = Math.floor(Math.random() * 15);
    const col = Math.floor(Math.random() * 15);
    const item = items[Math.floor(Math.random() * items.length)];
    map[row][col] = item;

    if (item === "harf_yasagi") {
      const letter = String.fromCharCode(65 + Math.floor(Math.random() * 29)); // Türkçeye göre güncellenebilir
      forbiddenLetters.push(letter);
    }

    if (item === "bolge_yasagi") {
      forbiddenZones[row][col] = true;
    }
  }

  return {
    map,
    forbiddenLetters: Array.from(forbiddenLetters),
    forbiddenZones,
  };
}

function generateLetterPool() {
  const pool = [];
  for (const [letter, count] of Object.entries(letterPoolDef)) {
    for (let i = 0; i < count; i++) {
      pool.push(letter);
    }
  }
  return pool.sort(() => Math.random() - 0.5);
}
function validateMove(game, username, word) {
  if (!game) return { status: 404, error: "Oyun bulunamadı" };
  if (game.status !== "active") return { status: 400, error: "Oyun aktif değil" };
  if (game.turn !== username) return { status: 403, error: "Sıra sizde değil" };
  if (!isValidWord(word)) return { status: 400, error: "Geçersiz kelime" };
  return null;
}


// Yeni oyun başlat
router.post("/start-game", async (req, res) => {
  const { username, duration } = req.body;

  let waitingGame = await Game.findOne({
    status: "waiting",
    duration,
    players: { $ne: username },
  });

  if (waitingGame) {
    waitingGame.players.push(username);
    waitingGame.status = "active";
    waitingGame.turn = waitingGame.players[0];
    waitingGame.pool = waitingGame.pool || generateLetterPool();
    waitingGame.letters = new Map();
    waitingGame.scores = new Map();
    waitingGame.lastMoveAt = new Date(); // Süre buradan başlasın
    waitingGame.createdAt = new Date(); // Süre takibi için başlangıç

    for (const player of waitingGame.players) {
      waitingGame.letters.set(player, waitingGame.pool.splice(0, 7));
      waitingGame.scores.set(player, 0);
    }

    await waitingGame.save();
    return res
      .status(200)
      .json({ message: "Eşleştirildiniz", game: waitingGame });
  }

  const { map: mineMap, forbiddenLetters, forbiddenZones } = generateMineMap();

  const newGame = new Game({
    players: [username],
    board: Array(15)
      .fill()
      .map(() => Array(15).fill("")),
    duration,
    pool: generateLetterPool(),
    letters: new Map([[username, []]]),
    scores: new Map([[username, 0]]),
    mineMap,
    forbiddenLetters,
    forbiddenZones,
    bonusMap: generateBonusMap(),
    status: "waiting",
  });

  await newGame.save();
  res.status(201).json({ message: "Beklemeye alındınız", game: newGame });
});

// !!! Sadece geçici kullanım için !!!
router.delete("/admin/clear-games", async (req, res) => {
  try {
    await Game.deleteMany({});
    res.status(200).json({ message: "Tüm oyunlar silindi" });
  } catch (err) {
    res
      .status(500)
      .json({ message: "Silme işlemi başarısız", error: err.message });
  }
});

router.get("/active-games/:username", async (req, res) => {
  const { username } = req.params;
  const games = await Game.find({ players: username, status: "active" });
  const enrichedGames = games.map((game) => ({
    ...game.toObject(),
    scores: Object.fromEntries(game.scores || []),
    letters: Object.fromEntries(game.letters || []),
  }));
  res.status(200).json(enrichedGames);
});

router.get("/finished-games/:username", async (req, res) => {
  const { username } = req.params;
  const games = await Game.find({ players: username, status: "finished" });
  const enrichedGames = games.map((game) => ({
    ...game.toObject(),
    scores: Object.fromEntries(game.scores || []),
    letters: Object.fromEntries(game.letters || []),
  }));
  res.status(200).json(enrichedGames);
});

router.post("/play", async (req, res) => {
  const { gameId, username, word, startRow, startCol, direction } = req.body;
  const game = await Game.findById(gameId);
  const validationError = validateMove(game, username, word);
    if (validationError) return res.status(validationError.status).json({ message: validationError.error });

  const board = game.board.map((row) => [...row]);
  const mineMap = game.mineMap || [];
  const bonusMap = game.bonusMap || [];
  const playerLetters = [...(game.letters.get(username) || [])];
  const opponent = game.players.find((p) => p !== username);

  const wordUpper = word.toUpperCase().split("");
  const tempLetters = [...playerLetters];

  for (let l of wordUpper) {
    const i = tempLetters.indexOf(l);
    if (i === -1) {
      return res.status(400).json({ message: `Elinizde '${l}' harfi yok` });
    }
    tempLetters.splice(i, 1);
  }

  let triggeredEffects = [];
  let revealedMines = [];
  let totalScore = 0;
  let wordMultiplier = 1;
  let usedLetters = [];
  let skipTurn = false;

  let deltaRow = 0;
  let deltaCol = 0;

  switch (direction) {
    case "horizontal": // →
      deltaRow = 0;
      deltaCol = 1;
      break;
    case "left": // ←
      deltaRow = 0;
      deltaCol = -1;
      break;
    case "vertical": // ↓
      deltaRow = 1;
      deltaCol = 0;
      break;
    case "up": // ↑
      deltaRow = -1;
      deltaCol = 0;
      break;
    case "diag-right-down": // ↘
      deltaRow = 1;
      deltaCol = 1;
      break;
    case "diag-left-down": // ↙
      deltaRow = 1;
      deltaCol = -1;
      break;
    case "diag-left-up": // ↖
      deltaRow = -1;
      deltaCol = -1;
      break;
    case "diag-right-up": // ↗
      deltaRow = -1;
      deltaCol = 1;
      break;
    default:
      return res.status(400).json({ message: "Geçersiz yön!" });
  }
  

  for (let i = 0; i < word.length; i++) {
    const row = startRow + i * deltaRow;
    const col = startCol + i * deltaCol;
    const letter = word[i].toUpperCase();

    // Tahtanın dışına çıkma kontrolü
    if (row < 0 || row >= 15 || col < 0 || col >= 15) {
      return res
        .status(400)
        .json({ message: `Kelime tahtanın dışına taşıyor!` });
    }

    // Yasak harf/bölge kontrolü
    if (game.forbiddenLetters?.includes(letter)) {
      return res.status(400).json({ message: `'${letter}' harfi yasaklı!` });
    }
    if (game.forbiddenZones?.[row]?.[col]) {
      return res
        .status(400)
        .json({ message: `(${row}, ${col}) konumu yasaklı bölge!` });
    }

    board[row][col] = letter;

    const bonus = bonusMap?.[row]?.[col];
    let letterScore = letterPoints[letter] || 0;
    if (bonus === "2H") letterScore *= 2;
    if (bonus === "3H") letterScore *= 3;
    if (bonus === "2W") wordMultiplier *= 2;
    if (bonus === "3W") wordMultiplier *= 3;

    totalScore += letterScore;
    usedLetters.push(letter);

    const effect = mineMap?.[row]?.[col];
    if (effect) {
      triggeredEffects.push(effect);
      revealedMines.push({ row, col, type: effect });
    }
  }

  totalScore *= wordMultiplier;

  if (triggeredEffects.includes("puan_dusur"))
    totalScore = Math.floor(totalScore * 0.7);
  if (triggeredEffects.includes("puan_iptali")) totalScore = 0;
  if (triggeredEffects.includes("puan_transfer") && opponent) {
    const opponentScore = game.scores.get(opponent) || 0;
    game.scores.set(opponent, opponentScore + totalScore);
    totalScore = 0;
  }
  if (triggeredEffects.includes("harf_kaybi")) playerLetters.length = 0;
  if (triggeredEffects.includes("joker_ekstra_harf")) {
    const extra = game.pool.splice(0, 1);
    playerLetters.push(...extra);
  }
  if (triggeredEffects.includes("joker_ekstra_hamle")) skipTurn = true;
  if (triggeredEffects.includes("joker_yasak_kaldır")) {
    game.forbiddenLetters = [];
    game.forbiddenZones = Array(15)
      .fill()
      .map(() => Array(15).fill(false));
  }
  if (triggeredEffects.includes("bolge_yasagi")) {
    const randRow = Math.floor(Math.random() * 13);
    const randCol = Math.floor(Math.random() * 13);
    for (let r = randRow; r < randRow + 3; r++) {
      for (let c = randCol; c < randCol + 3; c++) {
        game.forbiddenZones[r][c] = true;
      }
    }
  }
  if (triggeredEffects.includes("harf_yasagi")) {
    const all = Object.keys(letterPoints);
    const banned = all[Math.floor(Math.random() * all.length)];
    if (!game.forbiddenLetters.includes(banned)) {
      game.forbiddenLetters.push(banned);
    }
  }

  usedLetters.forEach((letter) => {
    const index = playerLetters.indexOf(letter);
    if (index !== -1) playerLetters.splice(index, 1);
  });

  const newLetters = game.pool.splice(0, 7 - playerLetters.length);
  playerLetters.push(...newLetters);
  game.letters.set(username, playerLetters);

  const prevScore = game.scores.get(username) || 0;
  game.scores.set(username, prevScore + totalScore);

  if (playerLetters.length === 0) {
    game.status = "finished";
    game.winner = username;
    game.board = board;
    await game.save();
    return res.status(200).json({
      message: "Hamle yapıldı ve oyun bitti",
      winner: username,
      board,
      effects: triggeredEffects,
      score: totalScore,
      revealedMines,
      forbiddenLetters: game.forbiddenLetters,
      forbiddenZones: game.forbiddenZones,
    });
  }

  game.board = board;
  if (!skipTurn) game.turn = opponent;

  game.lastMoveAt = new Date(); // Süre sıfırlansın
  game.createdAt = new Date(); // Süre sıfırlansın
  await game.save();

  res.status(200).json({
    message: "Hamle yapıldı",
    board,
    turn: game.turn,
    effects: triggeredEffects,
    score: totalScore,
    letters: Object.fromEntries(game.letters),
    scores: Object.fromEntries(game.scores),
    revealedMines,
    forbiddenLetters: game.forbiddenLetters,
    forbiddenZones: game.forbiddenZones,
  });
});

router.post("/end-game", async (req, res) => {
  const { gameId, username, reason } = req.body;
  const game = await Game.findById(gameId);
  if (!game) return res.status(404).json({ message: "Oyun bulunamadı" });

  if (game.status === "finished") {
    return res.status(400).json({ message: "Oyun zaten bitmiş" });
  }

  let winner = null;
  if (reason === "surrender") {
    winner = game.players.find((p) => p !== username);
  }

  game.status = "finished";
  game.winner = winner;
  await game.save();

  res.status(200).json({
    message: "Oyun bitirildi",
    winner: winner || "Beraberlik",
    finalBoard: game.board,
    letters: Object.fromEntries(game.letters),
    scores: Object.fromEntries(game.scores),
  });
});

router.post("/pass", async (req, res) => {
  const { gameId, username } = req.body;
  const game = await Game.findById(gameId);

  if (!game) return res.status(404).json({ message: "Oyun bulunamadı" });
  if (game.turn !== username)
    return res.status(403).json({ message: "Sıra sizde değil" });

  // passHistory başlat
  if (!game.passHistory) game.passHistory = new Map();

  // Mevcut sayıyı al
  const currentPassCount = game.passHistory.get(username) || 0;
  game.passHistory.set(username, currentPassCount + 1);

  // Map değiştiği için belirt
  game.markModified("passHistory");

  // Süreyi sıfırla
  game.lastMoveAt = new Date();

  game.createdAt = new Date(); // Süre yeniden başlasın

  // Oyun boyunca 2 kez pas geçme kontrolü
  if (game.passHistory.get(username) >= 2) {
    game.status = "finished";
    game.winner = game.players.find((p) => p !== username);
    await game.save();
    return res.status(200).json({
      message: "Aynı oyuncu toplamda 2 kez pas geçti, oyun bitti.",
      winner: game.winner,
      board: game.board,
    });
  }

  // Sıra değiştir
  const nextPlayer = game.players.find((p) => p !== username);
  game.turn = nextPlayer;

  await game.save();
  res.status(200).json({ message: "Pas geçildi", turn: game.turn });
});

router.get("/check-inactivity/:gameId", async (req, res) => {
  const { gameId } = req.params;
  const game = await Game.findById(gameId);

  if (!game) return res.status(404).json({ message: "Oyun bulunamadı" });
  if (game.status !== "active")
    return res.status(400).json({ message: "Oyun zaten bitmiş" });

  const now = new Date();
  const diffMs = now - new Date(game.lastMoveAt);
  const diffMins = diffMs / (1000 * 60);

  if (diffMins >= 60 && game.board.flat().every((cell) => cell === "")) {
    game.status = "finished";
    game.winner = null;
    await game.save();
    return res
      .status(200)
      .json({ message: "İlk hamle yapılmadı, oyun bitti." });
  }

  res.status(200).json({ message: "Oyun devam ediyor." });
});

router.get("/check-timer/:gameId", async (req, res) => {
  const { gameId } = req.params;
  const game = await Game.findById(gameId);

  if (!game) return res.status(404).json({ message: "Oyun bulunamadı" });
  if (game.status !== "active")
    return res.status(400).json({ message: "Oyun zaten bitmiş" });

  const now = new Date();
  const createdAt = new Date(game.createdAt);
  const elapsedSeconds = (now - createdAt) / 1000;

  if (elapsedSeconds >= game.duration) {
    game.status = "finished";

    const scores = Object.fromEntries(game.scores || []);
    const players = game.players;

    const score1 = scores[players[0]] || 0;
    const score2 = scores[players[1]] || 0;

    if (score1 > score2) game.winner = players[0];
    else if (score2 > score1) game.winner = players[1];
    else game.winner = null; // Beraberlik

    await game.save();

    return res.status(200).json({
      message: "Süre bitti, oyun sona erdi.",
      winner: game.winner || "Beraberlik",
      scores,
    });
  }

  const remaining = Math.ceil(game.duration - elapsedSeconds);
  res.status(200).json({ message: "Oyun devam ediyor", remaining });
});

router.get("/stats/:username", async (req, res) => {
  const { username } = req.params;

  const totalGames = await Game.countDocuments({
    players: username,
    status: "finished",
  });
  const wins = await Game.countDocuments({ winner: username });
  const losses = await Game.countDocuments({
    players: username,
    status: "finished",
    winner: { $ne: null, $ne: username },
  });
  const draws = await Game.countDocuments({
    players: username,
    status: "finished",
    winner: null,
  });

  const successRate =
    totalGames > 0 ? ((wins / totalGames) * 100).toFixed(1) : "0";

  res.status(200).json({
    username,
    totalGames,
    wins,
    losses,
    draws,
    successRate: `${successRate}%`,
  });
});

module.exports = router;
