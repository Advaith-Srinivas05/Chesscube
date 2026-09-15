export default {
  id: 'pawn',
  group: 'rules',
  title: 'The pawn',
  summary: 'Marches forward, captures diagonally.',
  steps: [
    {
      text: 'Pawns move straight forward, one square at a time. From its starting square a pawn may move two squares at once. Walk the pawn to the star.',
      fen: '7k/8/8/8/8/8/4P3/K7 w - - 0 1',
      goal: { type: 'reach', targets: ['e5'] },
    },
    {
      text: 'Pawns capture one square diagonally forward, never straight ahead. Capture both black pieces.',
      fen: '7k/8/5b2/4n3/3P4/8/8/K7 w - - 0 1',
      hint: 'Capture the knight first, then look diagonally again.',
      goal: { type: 'captureAll' },
    },
    {
      text: 'A pawn can’t capture the piece right in front of it. Win the rook with a pawn.',
      fen: '6k1/8/8/3r4/2P1P3/8/8/6K1 w - - 0 1',
      goal: { type: 'move', moves: ['c4d5', 'e4d5'] },
    },
    {
      text: 'Even a humble pawn can give checkmate. Find the pawn move that ends the game.',
      fen: '7k/5K1p/6P1/8/8/8/8/8 w - - 0 1',
      goal: { type: 'mate' },
    },
  ],
};
