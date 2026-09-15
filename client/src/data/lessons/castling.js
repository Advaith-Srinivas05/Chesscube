export default {
  id: 'castling',
  group: 'rules',
  title: 'Castling',
  summary: 'A special king-and-rook move to tuck the king away.',
  steps: [
    {
      text: 'Castling moves the king two squares towards a rook, and the rook jumps to the other side of the king. Castle kingside.',
      fen: '4k3/8/8/8/8/8/8/4K2R w K - 0 1',
      goal: { type: 'move', moves: ['e1g1'] },
    },
    {
      text: 'You can castle on the queenside too, with the rook on a1. Castle queenside.',
      fen: '4k3/8/8/8/8/8/8/R3K3 w Q - 0 1',
      goal: { type: 'move', moves: ['e1c1'] },
    },
    {
      text: 'You can’t castle out of check, through an attacked square or into check. The bishop covers f1, so castle the other way.',
      fen: '4k3/8/8/8/2b5/8/8/R3K2R w KQ - 0 1',
      hint: 'The king would pass over f1, which the bishop attacks.',
      goal: { type: 'move', moves: ['e1c1'] },
    },
    {
      text: 'Black castles the same way. Castle kingside with Black.',
      fen: 'r3k2r/8/8/8/8/8/8/4K3 b kq - 0 1',
      goal: { type: 'move', moves: ['e8g8'] },
    },
  ],
};
