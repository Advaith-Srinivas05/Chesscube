export default {
  id: 'pin',
  group: 'tactics',
  title: 'Pin',
  summary: 'A piece that can’t move without exposing a bigger one.',
  steps: [
    {
      text: 'A piece is pinned when moving it would expose a more valuable piece behind it. Pin the knight to the king.',
      fen: '4k3/8/8/4n3/8/8/8/R6K w - - 0 1',
      goal: { type: 'move', moves: ['a1e1'] },
    },
    {
      text: 'The knight is pinned to its king, so it can’t run away. Attack it with a pawn, then win it.',
      fen: '7k/8/5n2/8/4P3/8/1B6/6K1 w - - 0 1',
      hint: 'Push the e-pawn.',
      goal: { type: 'line', moves: ['e4e5', 'h8g8', 'e5f6'] },
    },
    {
      text: 'The e6-pawn is pinned to its king, so it can’t recapture on d5. Win the queen.',
      fen: '4k3/8/4p3/3q4/8/8/8/K2QR3 w - - 0 1',
      goal: { type: 'move', moves: ['d1d5'] },
    },
  ],
};
