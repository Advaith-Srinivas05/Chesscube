import { useEffect, useState } from 'react';
import { Chess } from 'chess.js';
import { createEngine } from '../lib/engine.js';
import ChessBoard from './ChessBoard.jsx';

const MOVE_DELAY = 1000;
const RESTART_DELAY = 3000;
const MAX_PLIES = 300;
const MIN_DEPTH = 2;
const MAX_DEPTH = 10;

function randomDepth() {
  return MIN_DEPTH + Math.floor(Math.random() * (MAX_DEPTH - MIN_DEPTH + 1));
}

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Stockfish plays itself on a loop, searching each move to a random depth so no two games are alike.
export default function RandomGame() {
  const [position, setPosition] = useState(() => new Chess().fen());

  useEffect(() => {
    const game = new Chess();
    const engine = createEngine();
    let active = true;

    async function loop() {
      while (active) {
        game.reset();
        setPosition(game.fen());
        await engine.newGame();
        await wait(MOVE_DELAY);

        while (active && !game.isGameOver() && game.history().length < MAX_PLIES) {
          const move = await engine.bestMove({ fen: game.fen(), depth: randomDepth() });
          if (!active || !move) break;
          game.move({ from: move.slice(0, 2), to: move.slice(2, 4), promotion: move[4] });
          setPosition(game.fen());
          await wait(MOVE_DELAY);
        }

        await wait(RESTART_DELAY - MOVE_DELAY);
      }
    }

    loop().catch(() => {});

    return () => {
      active = false;
      engine.terminate();
    };
  }, []);

  return <ChessBoard id="random-game" position={position} />;
}
