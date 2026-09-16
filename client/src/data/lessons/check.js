export default {
  id: 'check',
  group: 'rules',
  title: 'Check and checkmate',
  summary: 'Attack the king, and win when it can’t escape.',
  steps: [
    {
      text: 'Attacking the king is called check. Give check with the rook.',
      fen: '4k3/8/8/8/8/8/7K/R7 w - - 0 1',
      goal: { type: 'move', moves: ['a1a8', 'a1e1'] },
    },
    {
      text: 'In check you must deal with it at once: move the king, block the attack or capture the attacker. Here, capture the queen.',
      fen: '4k3/8/8/8/8/8/4q2R/4K3 w - - 0 1',
      goal: { type: 'move', moves: ['e1e2', 'h2e2'] },
    },
    {
      text: 'Your king is in check and has nowhere to go. Block the rook’s attack.',
      fen: '6k1/8/8/1B6/8/8/5PPP/r5K1 w - - 0 1',
      hint: 'Only one square on the back rank stops the check. Which one can the bishop reach?',
      goal: { type: 'move', moves: ['b5f1'] },
    },
    {
      text: 'Checkmate is a check that can’t be escaped, blocked or captured. It wins the game. Deliver checkmate.',
      fen: 'k7/8/1K6/8/8/8/8/2Q5 w - - 0 1',
      hint: 'Check the king along the back rank. Your king covers the other escape squares.',
      goal: { type: 'mate' },
    },
  ],
};
