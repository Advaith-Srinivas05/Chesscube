export default {
  id: 'promotion',
  group: 'rules',
  title: 'Promotion',
  summary: 'A pawn that reaches the end becomes a new piece.',
  steps: [
    {
      text: 'A pawn that reaches the far side of the board is promoted: it becomes a queen, rook, bishop or knight. March the pawn to the end.',
      fen: '8/8/4P2k/8/8/8/8/K7 w - - 0 1',
      goal: { type: 'reach', targets: ['e8'] },
    },
    {
      text: 'Most of the time the queen is the best choice. Promote with checkmate.',
      fen: 'k7/2P5/1K6/8/8/8/8/8 w - - 0 1',
      goal: { type: 'mate' },
    },
    {
      text: 'Sometimes a knight is better. Promote to a knight with check, attacking the queen, then take her.',
      fen: '8/2q1P1k1/8/8/8/8/8/7K w - - 0 1',
      hint: 'Choose the knight when you promote: from e8 it attacks g7 and c7.',
      goal: { type: 'line', moves: ['e7e8n', 'g7g6', 'e8c7'] },
    },
  ],
};
