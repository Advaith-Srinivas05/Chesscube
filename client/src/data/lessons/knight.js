export default {
  id: 'knight',
  group: 'rules',
  title: 'The knight',
  summary: 'Jumps in an L shape, right over other pieces.',
  steps: [
    {
      text: 'The knight moves in an L: two squares in a straight line, then one square to the side. Jump to the star.',
      fen: '7k/8/8/8/3N4/8/8/K7 w - - 0 1',
      goal: { type: 'reach', targets: ['e6'] },
    },
    {
      text: 'The knight is the only piece that can jump over others. Collect every star.',
      fen: '7k/8/8/8/8/8/PPPP4/KN6 w - - 0 1',
      goal: { type: 'reach', targets: ['c3', 'd5', 'f6'] },
    },
    {
      text: 'A knight captures by landing on an enemy piece. Capture every black pawn.',
      fen: '7k/8/2p5/4p3/8/5p2/8/K5N1 w - - 0 1',
      goal: { type: 'captureAll' },
    },
    {
      text: 'A knight can attack two pieces at once. That is called a fork. Find the square where it attacks both rooks.',
      fen: '7k/2r3r1/8/8/3N4/8/8/K7 w - - 0 1',
      hint: 'Count the L shapes from each rook. One square is an L away from both.',
      goal: { type: 'move', moves: ['d4e6'] },
    },
    {
      text: 'The best forks include the king. Give check while attacking the queen, then take her.',
      fen: '6k1/3q4/8/3N4/8/8/8/K7 w - - 0 1',
      hint: 'Look for a check that also hits d7.',
      goal: { type: 'line', moves: ['d5f6', 'g8h8', 'f6d7'] },
    },
    {
      text: "Black's king is boxed in by its own pieces. Deliver checkmate with the knight.",
      fen: '6rk/6pp/8/6N1/8/8/8/K7 w - - 0 1',
      goal: { type: 'mate' },
    },
  ],
};
