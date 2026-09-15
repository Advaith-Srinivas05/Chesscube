export default {
  id: 'king',
  group: 'rules',
  title: 'The king',
  summary: 'One square at a time, and never into danger.',
  steps: [
    {
      text: 'The king moves one square in any direction. Walk him to the star.',
      fen: '4k3/8/8/8/8/8/8/4K3 w - - 0 1',
      goal: { type: 'reach', targets: ['e3'] },
    },
    {
      text: 'The king may never move to a square an enemy piece attacks. The black rook guards the d-file down to your pawn. Reach the star.',
      fen: '3r3k/8/8/8/3P4/8/2K5/8 w - - 0 1',
      hint: 'Cross the d-file below your pawn.',
      goal: { type: 'reach', targets: ['e2'] },
    },
    {
      text: 'The king captures like it moves, but never a protected piece. Capture both pawns.',
      fen: 'k7/8/8/8/8/7p/6p1/6K1 w - - 0 1',
      hint: 'The h3-pawn guards g2. Take it first.',
      goal: { type: 'captureAll' },
    },
  ],
};
