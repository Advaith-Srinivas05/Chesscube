import { useEffect, useState } from 'react';
import { Chess } from 'chess.js';
import engineUrl from 'stockfish/bin/stockfish-18-lite-single.js?url';
import wasmUrl from 'stockfish/bin/stockfish-18-lite-single.wasm?url';
import ChessBoard from './ChessBoard.jsx';

const MOVE_DELAY = 1000;
const RESTART_DELAY = 3000;
const MAX_PLIES = 300;
const MIN_DEPTH = 2;
const MAX_DEPTH = 10;

function randomDepth() {
  return MIN_DEPTH + Math.floor(Math.random() * (MAX_DEPTH - MIN_DEPTH + 1));
}

// Stockfish plays itself on a loop, searching each move to a random depth so no two games are alike.
export default function RandomGame() {
  const [position, setPosition] = useState(() => new Chess().fen());

  useEffect(() => {
    const game = new Chess();
    // The engine reads the wasm location from the hash, since bundling renames both files.
    const engine = new Worker(`${engineUrl}#${encodeURIComponent(wasmUrl)}`);
    let timer;

    const think = () => {
      engine.postMessage(`position fen ${game.fen()}`);
      engine.postMessage(`go depth ${randomDepth()}`);
    };

    const restart = () => {
      game.reset();
      engine.postMessage('ucinewgame');
      setPosition(game.fen());
      timer = setTimeout(think, MOVE_DELAY);
    };

    engine.onmessage = ({ data }) => {
      if (typeof data !== 'string' || !data.startsWith('bestmove')) return;

      const bestMove = data.match(/^bestmove\s+([a-h][1-8][a-h][1-8][qrbn]?)/)?.[1];
      if (bestMove) {
        game.move({ from: bestMove.slice(0, 2), to: bestMove.slice(2, 4), promotion: bestMove[4] });
        setPosition(game.fen());
      }

      if (game.isGameOver() || game.history().length >= MAX_PLIES) {
        timer = setTimeout(restart, RESTART_DELAY);
      } else {
        timer = setTimeout(think, MOVE_DELAY);
      }
    };

    engine.postMessage('uci');
    engine.postMessage('isready');
    timer = setTimeout(think, MOVE_DELAY);

    return () => {
      clearTimeout(timer);
      engine.terminate();
    };
  }, []);

  return <ChessBoard id="random-game" position={position} />;
}
