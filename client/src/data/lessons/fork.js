export default {
  id: 'fork',
  group: 'tactics',
  title: 'Fork',
  summary: 'One piece attacks two at once.',
  steps: [
    {
      text: 'Any piece can fork, even a pawn. Attack both black pieces with one move.',
      fen: '6k1/8/2n1r3/8/3P4/8/8/6K1 w - - 0 1',
      goal: { type: 'move', moves: ['d4d5'] },
    },
    {
      text: 'Fork the king and the rook with the queen, then collect the rook.',
      fen: 'r5k1/6pp/8/8/8/8/8/3Q2K1 w - - 0 1',
      hint: 'Find a queen check on the diagonal that also hits a8.',
      goal: { type: 'line', moves: ['d1d5', 'g8h8', 'd5a8'] },
    },
    {
      text: 'The knight is the fork expert. Check the king and attack the queen, then take her.',
      fen: '2q1k3/8/8/1N2P3/8/8/8/6K1 w - - 0 1',
      hint: 'The e5-pawn protects d6.',
      goal: { type: 'line', moves: ['b5d6', 'e8e7', 'd6c8'] },
    },
  ],
};
