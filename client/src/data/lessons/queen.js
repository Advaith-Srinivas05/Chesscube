export default {
  id: 'queen',
  group: 'rules',
  title: 'The queen',
  summary: 'The strongest piece: a rook and a bishop in one.',
  steps: [
    {
      text: 'The queen moves like a rook and a bishop together: any straight line or diagonal. Move her to the star.',
      fen: '1k6/8/8/8/8/8/8/K2Q4 w - - 0 1',
      goal: { type: 'reach', targets: ['h5'] },
    },
    {
      text: 'Collect every star with the queen.',
      fen: '7k/8/8/8/8/8/8/K2Q4 w - - 0 1',
      goal: { type: 'reach', targets: ['b3', 'f7', 'f2'] },
    },
    {
      text: 'Capture every black piece with the queen.',
      fen: '4k3/8/r5b1/8/8/3n4/8/Q6K w - - 0 1',
      goal: { type: 'captureAll' },
    },
    {
      text: 'The queen is at her best with support. With the white king nearby, deliver checkmate.',
      fen: '7k/Q7/6K1/8/8/8/8/8 w - - 0 1',
      goal: { type: 'mate' },
    },
  ],
};
