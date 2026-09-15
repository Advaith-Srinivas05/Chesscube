export default {
  id: 'smothered-mate',
  group: 'mates',
  title: 'Smothered mate',
  summary: 'A knight mates a king boxed in by its own pieces.',
  steps: [
    {
      text: 'The black king is surrounded by its own pieces. Only a knight can reach it. Deliver checkmate.',
      fen: '6rk/6pp/3N4/8/8/8/8/K7 w - - 0 1',
      goal: { type: 'mate' },
    },
    {
      text: 'The famous queen sacrifice: check on g8, and when the rook takes the queen, the knight mates.',
      fen: '5r1k/6pp/7N/3Q4/8/8/8/6K1 w - - 0 1',
      hint: 'Qg8+ can only be taken by the rook, because the knight guards g8.',
      goal: { type: 'line', moves: ['d5g8', 'f8g8', 'h6f7'] },
    },
    {
      text: 'Now with Black. White’s king is boxed in by its own rook and pawns. Deliver checkmate.',
      fen: '6k1/8/8/8/8/4n3/PP6/KR6 b - - 0 1',
      goal: { type: 'mate' },
    },
  ],
};
