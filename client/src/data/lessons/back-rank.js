export default {
  id: 'back-rank',
  group: 'mates',
  title: 'Back-rank mate',
  summary: 'A king trapped behind its own pawns.',
  steps: [
    {
      text: 'A king behind a wall of its own pawns has no escape from a check along the back rank. Deliver checkmate.',
      fen: '6k1/5ppp/8/8/8/8/8/3R2K1 w - - 0 1',
      goal: { type: 'mate' },
    },
    {
      text: 'The queen guards the back rank. Take the rook with check, and after the queen recaptures, finish with your second rook.',
      fen: '3qr1k1/5ppp/8/8/8/8/4RPPP/4R1K1 w - - 0 1',
      hint: 'Start with Rxe8+: the queen is the only piece that can take back.',
      goal: { type: 'line', moves: ['e2e8', 'd8e8', 'e1e8'] },
    },
    {
      text: 'It works for Black too. White’s king is stuck behind its pawns. Deliver checkmate.',
      fen: 'r5k1/8/8/8/8/8/5PPP/6K1 b - - 0 1',
      goal: { type: 'mate' },
    },
  ],
};
