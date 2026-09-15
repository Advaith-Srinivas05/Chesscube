export default {
  id: 'en-passant',
  group: 'rules',
  title: 'En passant',
  summary: 'Capturing a pawn that has just rushed past.',
  steps: [
    {
      text: 'Black’s pawn has just moved two squares and landed beside yours. You may capture it as if it had moved one square, but only straight away. Capture en passant.',
      fen: '4k3/8/8/3pP3/8/8/8/4K3 w - d6 0 1',
      hint: 'Capture diagonally onto d6, the square the pawn skipped.',
      goal: { type: 'move', moves: ['e5d6'] },
    },
    {
      text: 'Push your a-pawn one square. When Black’s f-pawn jumps two squares, capture it en passant.',
      fen: '7k/5p2/8/4P3/8/8/P7/4K3 w - - 0 1',
      hint: 'First push the a-pawn one square. Then capture onto f6.',
      goal: { type: 'line', moves: ['a2a3', 'f7f5', 'e5f6'] },
    },
    {
      text: 'Black can capture en passant too. White has just pushed the c-pawn two squares. Capture it.',
      fen: '4k3/8/8/8/2Pp4/8/8/4K3 b - c3 0 1',
      goal: { type: 'move', moves: ['d4c3'] },
    },
  ],
};
