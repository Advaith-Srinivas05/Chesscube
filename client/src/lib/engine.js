import engineUrl from 'stockfish/bin/stockfish-18-lite-single.js?url';
import wasmUrl from 'stockfish/bin/stockfish-18-lite-single.wasm?url';

const SCORE = /\bscore (cp|mate) (-?\d+)/;

function parseInfo(line) {
  const depth = line.match(/\bdepth (\d+)/)?.[1];
  const pv = line.match(/\bpv (.+)$/)?.[1];
  const score = line.match(SCORE);
  if (!depth || !pv || !score) return null;
  return {
    depth: Number(depth),
    multipv: Number(line.match(/\bmultipv (\d+)/)?.[1] ?? 1),
    score: score[1] === 'cp' ? { cp: Number(score[2]) } : { mate: Number(score[2]) },
    pv: pv.trim().split(/\s+/),
  };
}

function goCommand({ depth, movetime }) {
  const parts = ['go'];
  if (depth) parts.push('depth', depth);
  if (movetime) parts.push('movetime', movetime);
  if (parts.length === 1) parts.push('infinite');
  return parts.join(' ');
}

// Stockfish (lite, single-threaded) in a Web Worker. Runs one search at a time: a new request stops
// the current search, waits for its `bestmove`, then starts. UCI moves go in and come out as-is.
export function createEngine() {
  // The engine reads the wasm location from the hash, since bundling renames both files.
  const worker = new Worker(`${engineUrl}#${encodeURIComponent(wasmUrl)}`);
  const lineListeners = new Set();
  let queue = Promise.resolve();
  let searching = false;
  let readyPromise = null;
  let terminated = false;

  worker.onmessage = ({ data }) => {
    if (typeof data !== 'string') return;
    for (const listener of [...lineListeners]) listener(data);
  };

  const send = (command) => {
    if (!terminated) worker.postMessage(command);
  };

  const waitFor = (test) =>
    new Promise((resolve) => {
      const listener = (line) => {
        if (!test(line)) return;
        lineListeners.delete(listener);
        resolve(line);
      };
      lineListeners.add(listener);
    });

  function ready() {
    if (!readyPromise) {
      readyPromise = waitFor((line) => line === 'readyok');
      send('uci');
      send('isready');
    }
    return readyPromise;
  }

  async function sync() {
    const done = waitFor((line) => line === 'readyok');
    send('isready');
    await done;
  }

  // Commands run one after another. Queuing anything stops the running search so it finishes quickly.
  function exclusive(task) {
    if (searching) send('stop');
    const run = queue.then(async () => {
      await ready();
      if (terminated) throw new Error('Engine was terminated');
      return task();
    });
    queue = run.catch(() => {});
    return run;
  }

  function stop() {
    if (searching) send('stop');
    return queue;
  }

  // onLine sees every engine line during this search.
  function search(setup, go, onLine) {
    return exclusive(async () => {
      for (const command of setup) send(command);
      const finished = waitFor((line) => line.startsWith('bestmove'));
      if (onLine) lineListeners.add(onLine);
      searching = true;
      send(go);
      try {
        return await finished;
      } finally {
        searching = false;
        if (onLine) lineListeners.delete(onLine);
      }
    });
  }

  const positionCommand = (fen, moves = []) =>
    `position ${fen ? `fen ${fen}` : 'startpos'}${moves.length ? ` moves ${moves.join(' ')}` : ''}`;

  return {
    ready,

    setOption(name, value) {
      return exclusive(() => {
        send(`setoption name ${name} value ${value}`);
        return sync();
      });
    },

    newGame() {
      return exclusive(() => {
        send('ucinewgame');
        return sync();
      });
    },

    // Resolves to the best move in UCI, or null when there is none (mate or stalemate on the board).
    async bestMove({ fen, moves, depth, movetime, skill }) {
      const setup = [];
      if (skill !== undefined) setup.push(`setoption name Skill Level value ${skill}`);
      setup.push(positionCommand(fen, moves));
      const line = await search(setup, goCommand({ depth, movetime }));
      const move = line.split(/\s+/)[1];
      return move && move !== '(none)' ? move : null;
    },

    // Streams parsed `info` lines to onInfo. Returns a function that stops the analysis.
    analyse({ fen, moves, depth, multipv = 1 }, onInfo) {
      const setup = [`setoption name MultiPV value ${multipv}`, positionCommand(fen, moves)];
      const onLine = (line) => {
        if (!line.startsWith('info')) return;
        const info = parseInfo(line);
        if (info) onInfo(info);
      };
      search(setup, goCommand({ depth }), onLine).catch(() => {});
      return () => stop();
    },

    stop,

    terminate() {
      terminated = true;
      lineListeners.clear();
      worker.terminate();
    },
  };
}
