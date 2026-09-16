export default {
  id: 'en-passant',
  group: 'rules',
  title: 'En passant',
  summary: 'Capturing a pawn that has just rushed past.',
  steps: [
    {
      text: 'Watch Black’s pawn rush two squares to land beside yours. You may capture it as if it had moved one square, but only straight away. Capture en passant.',
      fen: '4k3/3p4/8/4P3/8/8/8/4K3 b - - 0 1',
      intro: 'd7d5',
      hint: 'Capture diagonally onto d6, the square the pawn skipped.',
      goal: { type: 'move', moves: ['e5d6'] },
    },
    {
      text: 'The chance only lasts one move, so wait for it. Play any move that leaves your e-pawn alone; then, when Black’s f-pawn jumps two squares, capture it en passant.',
      fen: '7k/5p2/8/4P3/8/8/P7/4K3 w - - 0 1',
      hint: 'Wait with the a-pawn or the king — not the e-pawn. Then capture onto f6.',
      goal: { type: 'line', moves: [{ anyExcept: ['e5'] }, 'f7f5', 'e5f6'] },
    },
    {
      text: 'Black can capture en passant too. Watch White push the c-pawn two squares past your pawn, then capture it.',
      fen: '4k3/8/8/8/3p4/8/2P5/4K3 w - - 0 1',
      intro: 'c2c4',
      goal: { type: 'move', moves: ['d4c3'] },
    },
  ],
};
