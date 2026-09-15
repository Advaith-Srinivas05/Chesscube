export default {
  id: 'skewer',
  group: 'tactics',
  title: 'Skewer',
  summary: 'Attack a big piece and win the one behind it.',
  steps: [
    {
      text: 'A skewer attacks a valuable piece, and when it moves away, the piece behind it falls. Check the king, then take the rook.',
      fen: '4r3/8/8/4k3/8/8/8/R6K w - - 0 1',
      hint: 'Put the rook on the same file as the king and its rook.',
      goal: { type: 'line', moves: ['a1e1', 'e5d5', 'e1e8'] },
    },
    {
      text: 'Bishops skewer along diagonals. Check the king, then win the queen.',
      fen: '4q3/8/2k5/8/8/8/8/3B3K w - - 0 1',
      hint: 'The king and queen share the a4–e8 diagonal.',
      goal: { type: 'line', moves: ['d1a4', 'c6c5', 'a4e8'] },
    },
    {
      text: 'Find the rook move that skewers the king and the rook.',
      fen: '8/3k3r/8/8/8/8/8/R5K1 w - - 0 1',
      goal: { type: 'move', moves: ['a1a7'] },
    },
  ],
};
