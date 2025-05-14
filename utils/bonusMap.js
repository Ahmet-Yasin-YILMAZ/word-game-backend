function generateBonusMap() {
    const map = Array(15).fill().map(() => Array(15).fill(null));
  
    const TW = [ // Triple Word
      [0, 0], [0, 7], [0, 14],
      [7, 0], [7, 14],
      [14, 0], [14, 7], [14, 14]
    ];
    const DW = [ // Double Word
      [1, 1], [2, 2], [3, 3], [4, 4],
      [10, 10], [11, 11], [12, 12], [13, 13],
      [1, 13], [2, 12], [3, 11], [4, 10],
      [10, 4], [11, 3], [12, 2], [13, 1],
      [7, 7]
    ];
    const TL = [ // Triple Letter
      [1, 5], [1, 9], [5, 1], [5, 5],
      [5, 9], [5, 13], [9, 1], [9, 5],
      [9, 9], [9, 13], [13, 5], [13, 9]
    ];
    const DL = [ // Double Letter
      [0, 3], [0, 11], [2, 6], [2, 8],
      [3, 0], [3, 7], [3, 14], [6, 2],
      [6, 6], [6, 8], [6, 12], [7, 3],
      [7, 11], [8, 2], [8, 6], [8, 8],
      [8, 12], [11, 0], [11, 7], [11, 14],
      [12, 6], [12, 8], [14, 3], [14, 11]
    ];
  
    TW.forEach(([r, c]) => map[r][c] = '3W');
    DW.forEach(([r, c]) => map[r][c] = '2W');
    TL.forEach(([r, c]) => map[r][c] = '3H');
    DL.forEach(([r, c]) => map[r][c] = '2H');
  
    return map;
  }
  
  module.exports = generateBonusMap;
  