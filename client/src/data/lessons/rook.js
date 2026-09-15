export default {
  id: 'rook',
  group: 'rules',
  title: 'The rook',
  summary: 'Moves in straight lines along ranks and files.',
  steps: [
    {
      text: 'The rook moves in a straight line: up, down, left or right, as far as it likes. Move it to the star.',
      fen: '8/8/7k/8/3R4/8/8/K7 w - - 0 1',
      goal: { type: 'reach', targets: ['d8'] },
    },
    {
      text: 'A rook can’t jump over pieces, not even your own. Collect every star.',
      fen: '4k3/8/8/8/3P4/8/1R6/7K w - - 0 1',
      goal: { type: 'reach', targets: ['b4', 'g4', 'g7'] },
    },
    {
      text: 'The rook captures by landing on an enemy piece. Capture all three.',
      fen: '7k/8/8/n3b3/8/8/4n3/R6K w - - 0 1',
      goal: { type: 'captureAll' },
    },
    {
      text: 'With the kings facing each other, the rook finishes the job. Deliver checkmate.',
      fen: '7k/8/7K/8/8/8/8/R7 w - - 0 1',
      goal: { type: 'mate' },
    },
  ],
};
