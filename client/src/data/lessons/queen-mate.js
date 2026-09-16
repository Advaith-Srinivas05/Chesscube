export default {
  id: 'queen-mate',
  group: 'mates',
  title: 'King and queen vs king',
  summary: 'Checkmating with a queen, without stalemate.',
  steps: [
    {
      text: 'With your king in front of theirs, the queen mates on the edge. Deliver checkmate.',
      fen: '3k4/8/3K4/8/8/8/8/Q7 w - - 0 1',
      goal: { type: 'mate' },
    },
    {
      text: 'Careful: if the king has no legal move but isn’t in check, it’s stalemate and the game is a draw. Deliver checkmate, not stalemate.',
      fen: '7k/5K2/8/8/8/8/8/1Q6 w - - 0 1',
      hint: 'Qg6 would be stalemate. Give check along the h-file instead.',
      goal: { type: 'mate' },
    },
    {
      text: 'Your king is too far away to mate on its own, so use the queen to shut the king in first. Take the seventh rank away, walk your king up, then mate.',
      fen: '5k2/8/8/3K4/8/8/8/7Q w - - 0 1',
      hint: 'Qh7 takes the whole seventh rank away. Then walk your king up to e6 and mate on the seventh.',
      goal: { type: 'line', moves: ['h1h7', 'f8e8', 'd5e6', 'e8d8', 'h7d7'] },
    },
  ],
};
