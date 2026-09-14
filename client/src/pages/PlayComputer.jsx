import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useSearchParams } from 'react-router-dom';
import Avatar from '../components/Avatar.jsx';
import InteractiveBoard from '../components/board/InteractiveBoard.jsx';
import Clock from '../components/game/Clock.jsx';
import GameControls from '../components/game/GameControls.jsx';
import GameResult from '../components/game/GameResult.jsx';
import GameView from '../components/game/GameView.jsx';
import MaterialDiff from '../components/game/MaterialDiff.jsx';
import MoveList, { navigatePly } from '../components/game/MoveList.jsx';
import PlayerBar from '../components/game/PlayerBar.jsx';
import ComputerGameDialog from '../components/play/ComputerGameDialog.jsx';
import Button from '../components/ui/Button.jsx';
import Spinner from '../components/ui/Spinner.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { useSettings } from '../context/SettingsContext.jsx';
import { parseComputerParams } from '../data/computerGame.js';
import useComputerGame from '../hooks/useComputerGame.js';
import { createEngine } from '../lib/engine.js';
import { playSound } from '../lib/sounds.js';
import { formatTimeControl, VARIANTS } from '../shared/gameModes.js';
import styles from './PlayComputer.module.css';

function EngineAvatar({ size = 38 }) {
  return (
    <span className={styles.engineAvatar} style={{ width: size, height: size }} aria-hidden="true">
      <svg viewBox="0 0 24 24">
        <rect x="6.5" y="6.5" width="11" height="11" rx="2" />
        <rect x="9.75" y="9.75" width="4.5" height="4.5" rx="0.8" />
        <path d="M9.5 3v3.5M14.5 3v3.5M9.5 17.5V21M14.5 17.5V21M3 9.5h3.5M3 14.5h3.5M17.5 9.5H21M17.5 14.5H21" />
      </svg>
    </span>
  );
}

function ComputerGame({ engine, config, onPlayAgain, onNewGame }) {
  const { user } = useAuth();
  const { settings } = useSettings();
  const game = useComputerGame({ engine, ...config });
  const [orientation, setOrientation] = useState(game.playerColor);
  const playing = game.status === 'playing';

  const lowTime = useCallback(() => {
    if (settings.sounds) playSound('lowTime', settings.soundTheme);
  }, [settings.sounds, settings.soundTheme]);

  const bar = (color) => {
    const isPlayer = color === game.playerColor;
    const clock = game.clocks && (
      <Clock
        ms={game.clocks[color]}
        running={game.clockColor === color}
        syncedAt={game.syncedAt}
        onLowTime={isPlayer ? lowTime : undefined}
      />
    );
    const common = {
      material: <MaterialDiff fen={game.fen} color={color} />,
      clock,
      active: playing && game.turn === color && game.atLatest,
    };
    if (!isPlayer) {
      return <PlayerBar {...common} name={`Stockfish · Level ${config.level}`} avatar={<EngineAvatar />} />;
    }
    return user ? (
      <PlayerBar {...common} username={user.username} avatar={<Avatar id={user.avatar} />} />
    ) : (
      <PlayerBar {...common} name="Guest" avatar={<Avatar />} />
    );
  };

  const bottomColor = orientation;
  const topColor = orientation === 'white' ? 'black' : 'white';

  const prompt = !game.engineReady ? (
    <p className={styles.note}>
      <Spinner size={14} label={null} /> Loading the engine…
    </p>
  ) : null;

  return (
    <GameView
      label="Game against the computer"
      board={
        <InteractiveBoard
          id="computer-board"
          fen={game.fen}
          orientation={orientation}
          movableColor={playing ? game.playerColor : null}
          turn={game.turn}
          dests={game.dests}
          lastMove={game.lastMove}
          check={game.check}
          onMove={game.move}
          viewOnly={!playing || !game.atLatest}
          premove={game.premove}
          onPremove={settings.premoves ? game.setPremove : undefined}
          onCancelPremove={game.cancelPremove}
          variant={config.variant}
        />
      }
      topBar={bar(topColor)}
      bottomBar={bar(bottomColor)}
      moveList={<MoveList moves={game.moves} viewPly={game.viewPly} onSelect={game.setViewPly} />}
      prompt={prompt}
      controls={
        <GameControls
          canAbort={game.canAbort}
          onAbort={game.abort}
          showDraw={false}
          canResign={playing && !game.canAbort}
          onResign={game.resign}
          onFlip={() => setOrientation((current) => (current === 'white' ? 'black' : 'white'))}
        />
      }
      result={
        !playing && (
          <GameResult
            result={game.result}
            termination={game.termination}
            actions={
              <>
                <Button onClick={onPlayAgain}>Play again</Button>
                <Button variant="secondary" onClick={onNewGame}>
                  New game
                </Button>
              </>
            }
          />
        )
      }
      onNavigate={(action) => game.setViewPly(navigatePly(action, game.viewPly, game.moves.length))}
      viewingHistory={!game.atLatest}
      onBackToGame={() => game.setViewPly(game.moves.length)}
    />
  );
}

// /play/computer?level=3&variant=standard&color=random&tc=5+3 — local game, open to guests, nothing saved.
export default function PlayComputer() {
  const [params] = useSearchParams();
  const location = useLocation();
  const config = useMemo(() => parseComputerParams(params), [params]);
  const [engine, setEngine] = useState(null);
  const [round, setRound] = useState(0);
  const [dialogOpen, setDialogOpen] = useState(false);

  useEffect(() => {
    const created = createEngine();
    setEngine(created);
    return () => created.terminate();
  }, []);

  useEffect(() => {
    document.title = 'Play vs computer · Chesscube';
    return () => {
      document.title = 'Chesscube';
    };
  }, []);

  const variantName = VARIANTS.find((variant) => variant.id === config.variant)?.name;
  const summary = [variantName, config.tc ? formatTimeControl(config.tc) : 'Unlimited time', `Level ${config.level}`];

  return (
    <div className="page">
      <h1 className="sr-only">Play against the computer</h1>
      <div className={styles.header}>
        <Link to="/play" className={styles.back}>
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M15 5l-7 7 7 7" />
          </svg>
          Play
        </Link>
        <p className={styles.summary}>{summary.join(' · ')}</p>
      </div>

      <ComputerGame
        key={`${location.key}-${round}`}
        engine={engine}
        config={config}
        onPlayAgain={() => setRound((current) => current + 1)}
        onNewGame={() => setDialogOpen(true)}
      />

      <ComputerGameDialog open={dialogOpen} onClose={() => setDialogOpen(false)} initial={config} />
    </div>
  );
}
