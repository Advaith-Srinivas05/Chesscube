export default {
  id: 'bishop',
  group: 'rules',
  title: 'The bishop',
  summary: 'Slides along diagonals and stays on one colour.',
  steps: [
    {
      text: 'The bishop moves diagonally, as many squares as it likes. Slide it to the star.',
      fen: 'k7/8/8/8/8/8/8/K1B5 w - - 0 1',
      goal: { type: 'reach', targets: ['h6'] },
    },
    {
      text: 'A bishop never leaves the colour it starts on. Collect every star.',
      fen: 'k7/8/8/8/8/8/8/2B1K3 w - - 0 1',
      goal: { type: 'reach', targets: ['a3', 'd6', 'h2'] },
    },
    {
      text: 'Bishops capture the same way they move. Capture every black pawn.',
      fen: 'k7/6p1/1p6/8/3B4/8/5p2/7K w - - 0 1',
      goal: { type: 'captureAll' },
    },
    {
      text: 'Two bishops working together are strong. Deliver checkmate.',
      fen: '7k/8/4B1K1/8/7B/8/8/8 w - - 0 1',
      hint: 'One bishop already covers g8. Use the other to give check.',
      goal: { type: 'mate' },
    },
  ],
};
