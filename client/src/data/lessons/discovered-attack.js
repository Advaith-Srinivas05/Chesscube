export default {
  id: 'discovered-attack',
  group: 'tactics',
  title: 'Discovered attack',
  summary: 'Move one piece to unleash another.',
  steps: [
    {
      text: 'Moving a piece can uncover an attack by the piece behind it. Move the knight so the rook gives check and the knight attacks the queen.',
      fen: '4k3/8/8/8/4N3/3q4/8/K3R3 w - - 0 1',
      hint: 'Every knight move uncovers the check. Find the one that hits the queen as well.',
      goal: { type: 'move', moves: ['e4f2', 'e4c5'] },
    },
    {
      text: 'The knight is in the bishop’s way. Check the king with it, uncovering the bishop’s attack on the queen, then take the queen.',
      fen: '7q/2k5/8/1P6/3N4/8/1B6/6K1 w - - 0 1',
      hint: 'Which knight move gives check?',
      goal: { type: 'line', moves: ['d4e6', 'c7b7', 'b2h8'] },
    },
    {
      text: 'A discovered check can be checkmate. Move the knight out of the rook’s way.',
      fen: 'k3N2R/pp6/8/8/8/8/8/6K1 w - - 0 1',
      goal: { type: 'mate' },
    },
  ],
};
