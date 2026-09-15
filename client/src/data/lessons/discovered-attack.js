export default {
  id: 'discovered-attack',
  group: 'tactics',
  title: 'Discovered attack',
  summary: 'Move one piece to unleash another.',
  steps: [
    {
      text: 'Moving a piece can uncover an attack by the piece behind it. Move the knight so the rook gives check while the knight attacks the queen.',
      fen: '4k3/8/8/8/4N1q1/8/8/K3R3 w - - 0 1',
      goal: { type: 'move', moves: ['e4f2', 'e4f6'] },
    },
    {
      text: 'Check the king with the knight, uncovering the bishop’s attack on the queen. Then take the queen.',
      fen: '8/2k3q1/8/1P6/3N4/8/1B6/7K w - - 0 1',
      hint: 'Which knight move gives check?',
      goal: { type: 'line', moves: ['d4e6', 'c7b7', 'b2g7'] },
    },
    {
      text: 'A discovered check can be checkmate. Move the knight out of the rook’s way.',
      fen: 'k3N2R/pp6/8/8/8/8/8/6K1 w - - 0 1',
      goal: { type: 'mate' },
    },
  ],
};
