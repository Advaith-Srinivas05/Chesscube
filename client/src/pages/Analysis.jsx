import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useParams, useSearchParams } from 'react-router-dom';
import EngineLines from '../components/analysis/EngineLines.jsx';
import EvalBar from '../components/analysis/EvalBar.jsx';
import MoveTree from '../components/analysis/MoveTree.jsx';
import PositionTools from '../components/analysis/PositionTools.jsx';
import InteractiveBoard from '../components/board/InteractiveBoard.jsx';
import Button from '../components/ui/Button.jsx';
import EmptyState from '../components/ui/EmptyState.jsx';
import Spinner from '../components/ui/Spinner.jsx';
import { useToast } from '../components/ui/Toast.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import useAnalysis, { useEngineLines } from '../hooks/useAnalysis.js';
import { api } from '../lib/api.js';
import { createEngine } from '../lib/engine.js';
import styles from './Analysis.module.css';

// Fixed colour so it reads on every board theme and stays apart from the player's own (orange/green/red) arrows.
const BEST_MOVE_COLOR = '#2f7fd0';
const KEY_ACTIONS = { ArrowLeft: 'prev', ArrowRight: 'next', Home: 'first', End: 'last' };

function AnalysisBoard({ engine, initial }) {
  const toast = useToast();
  const analysis = useAnalysis(initial);
  const [orientation, setOrientation] = useState(initial.orientation === 'black' ? 'black' : 'white');
  const [engineOn, setEngineOn] = useState(true);
  const { ready, lines, over, maxDepth } = useEngineLines({
    engine,
    fen: analysis.fen,
    variant: analysis.variant,
    enabled: engineOn,
  });
  const { navigate, error } = analysis;

  useEffect(() => {
    if (error) toast.show(`Couldn't load that position: ${error}`, { tone: 'danger' });
  }, [error, toast]);

  useEffect(() => {
    function handleKeyDown(event) {
      const action = KEY_ACTIONS[event.key];
      if (!action || event.altKey || event.ctrlKey || event.metaKey) return;
      if (event.target.closest?.('input, textarea, select, [contenteditable="true"], dialog[open]')) return;
      event.preventDefault();
      navigate(action);
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [navigate]);

  function load(input) {
    const warning = analysis.load(input);
    if (warning) toast.show(warning, { tone: 'danger' });
  }

  const score = engineOn ? lines[0]?.score : null;
  const bestUci = engineOn ? lines[0]?.bestUci : null;
  const arrows = useMemo(
    () => (bestUci ? [{ startSquare: bestUci.slice(0, 2), endSquare: bestUci.slice(2, 4), color: BEST_MOVE_COLOR }] : []),
    [bestUci]
  );

  return (
    <>
      <div className={styles.header}>
        <Link to="/learn" className={styles.back}>
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M15 5l-7 7 7 7" />
          </svg>
          Learn
        </Link>
        <p className={styles.summary}>
          Analysis board{analysis.variant === 'chess960' ? ' · Chess960' : ''}
        </p>
      </div>

      <div className={styles.view}>
        <div className={`${styles.boardRow} ${engineOn ? '' : styles.noBar}`}>
          {engineOn && <EvalBar score={score} over={over} orientation={orientation} />}
          <div className={styles.board}>
            <InteractiveBoard
              id="analysis-board"
              fen={analysis.fen}
              orientation={orientation}
              movableColor="both"
              turn={analysis.turn}
              dests={analysis.dests}
              lastMove={analysis.lastMove}
              check={analysis.check}
              onMove={({ from, to, promotion }) => analysis.play(`${from}${to}${promotion ?? ''}`)}
              variant={analysis.variant}
              arrows={arrows}
            />
          </div>
        </div>

        <aside className={styles.panel} aria-label="Analysis panel">
          <EngineLines
            enabled={engineOn}
            onToggle={setEngineOn}
            ready={ready}
            lines={lines}
            over={over}
            maxDepth={maxDepth}
            onPlay={analysis.play}
          />
          <MoveTree
            root={analysis.root}
            current={analysis.current}
            version={analysis.version}
            isStart={analysis.isStart}
            isEnd={analysis.isEnd}
            inVariation={analysis.inVariation}
            onSelect={analysis.goTo}
            onNavigate={navigate}
            onPromote={analysis.promote}
            onRemove={analysis.remove}
          />
          <PositionTools
            fen={analysis.fen}
            onFlip={() => setOrientation((current) => (current === 'white' ? 'black' : 'white'))}
            getPgn={analysis.exportPgn}
            onLoadFen={(fen) => load({ fen })}
            onLoadPgn={(pgn) => load({ pgn })}
          />
        </aside>
      </div>
    </>
  );
}

// /learn/analysis/:gameId — a stored game, oriented for the viewer when they played it.
function StoredGameAnalysis({ gameId, engine }) {
  const { user } = useAuth();
  const [state, setState] = useState({ status: 'loading' });

  useEffect(() => {
    const controller = new AbortController();
    setState({ status: 'loading' });
    api
      .get(`/games/${encodeURIComponent(gameId)}`, { signal: controller.signal })
      .then(({ game }) => {
        const orientation = user && game.black.username === user.username ? 'black' : 'white';
        setState({ status: 'ready', initial: { variant: game.variant, fen: game.initialFen ?? undefined, moves: game.moves, orientation } });
      })
      .catch((err) => {
        if (err.name !== 'AbortError') setState({ status: err.status === 409 ? 'live' : 'notfound' });
      });
    return () => controller.abort();
  }, [gameId, user?.username]);

  if (state.status === 'loading') {
    return (
      <div className={styles.loading}>
        <Spinner label="Loading the game" />
      </div>
    );
  }
  if (state.status === 'ready') return <AnalysisBoard engine={engine} initial={state.initial} />;
  return (
    <EmptyState
      className={styles.notFound}
      title={state.status === 'live' ? 'This game is still being played' : 'Game not found'}
      text={state.status === 'live' ? 'You can analyse it once it has finished.' : "This game doesn't exist or can't be opened."}
      action={
        <Button as={Link} to="/learn/analysis">
          Open an empty board
        </Button>
      }
    />
  );
}

/**
 * /learn/analysis?fen=&variant= — free analysis board, open to guests.
 * Router state { variant, initialFen, moves, orientation } opens a finished game (vs computer or online).
 * /learn/analysis/:gameId loads a stored game.
 */
export default function Analysis() {
  const { gameId } = useParams();
  const [params] = useSearchParams();
  const location = useLocation();
  const [engine, setEngine] = useState(null);

  useEffect(() => {
    const created = createEngine();
    setEngine(created);
    return () => created.terminate();
  }, []);

  useEffect(() => {
    document.title = 'Analysis board · Chesscube';
    return () => {
      document.title = 'Chesscube';
    };
  }, []);

  const initial = useMemo(() => {
    const state = location.state;
    if (Array.isArray(state?.moves)) {
      return { variant: state.variant, fen: state.initialFen, moves: state.moves, orientation: state.orientation };
    }
    return { variant: params.get('variant') ?? undefined, fen: params.get('fen') ?? undefined };
  }, [location.key]);

  return (
    <div className="page">
      <h1 className="sr-only">Analysis board</h1>
      {gameId ? (
        <StoredGameAnalysis key={gameId} gameId={gameId} engine={engine} />
      ) : (
        <AnalysisBoard key={location.key} engine={engine} initial={initial} />
      )}
    </div>
  );
}
