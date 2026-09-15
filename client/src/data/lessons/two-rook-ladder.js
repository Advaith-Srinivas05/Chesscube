export default {
  id: 'two-rook-ladder',
  group: 'mates',
  title: 'Two-rook ladder',
  summary: 'Two rooks take turns pushing the king to the edge.',
  steps: [
    {
      text: 'One rook cuts the king off along a rank while the other gives check, pushing it back rank by rank. Climb the ladder to checkmate.',
      fen: '8/8/8/3k4/R7/7R/8/4K3 w - - 0 1',
      hint: 'Always check with the rook that is not guarding the rank below the king.',
      goal: { type: 'line', moves: ['h3h5', 'd5d6', 'a4a6', 'd6d7', 'h5h7', 'd7d8', 'a6a8'] },
    },
    {
      text: 'The king is on the edge and the a-rook guards the seventh rank. Deliver checkmate.',
      fen: '4k3/R7/8/8/8/8/8/1R4K1 w - - 0 1',
      goal: { type: 'mate' },
    },
    {
      text: 'If the king attacks a rook, move that rook to the far side of the board along its rank, then keep climbing.',
      fen: '8/8/2k5/1R6/R7/8/8/4K3 w - - 0 1',
      hint: 'Slide the attacked rook all the way to h5.',
      goal: { type: 'line', moves: ['b5h5', 'c6d6', 'a4a6', 'd6e7', 'h5h7', 'e7d8', 'a6a8'] },
    },
  ],
};
