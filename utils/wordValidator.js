const kelimeler = require('./kelimeler.json');

function isValidWord(word) {
  return kelimeler.includes(word.toLowerCase());
}

module.exports = { isValidWord };
