import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { INITIAL_FEN } from 'chessops/fen';
import Avatar from '../components/Avatar.jsx';
import InteractiveBoard from '../components/board/InteractiveBoard.jsx';
import Clock from '../components/game/Clock.jsx';
import GameControls from '../components/game/GameControls.jsx';
import GameResult from '../components/game/GameResult.jsx';
import GameView from '../components/game/GameView.jsx';
import MaterialDiff from '../components/game/MaterialDiff.jsx';
import MoveList, { navigatePly } from '../components/game/MoveList.jsx';
import PlayerBar from '../components/game/PlayerBar.jsx';
import Button from '../components/ui/Button.jsx';
import EmptyState from '../components/ui/EmptyState.jsx';
import Spinner from '../components/ui/Spinner.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { useSettings } from '../context/SettingsContext.jsx';
import useOnlineGame from '../hooks/useOnlineGame.js';
import { api } from '../lib/api.js';
import { applyMove, positionFromFen } from '../lib/chess/rules.js';
import { playSound } from '../lib/sounds.js';
import { CATEGORIES, formatTimeControl } from '../shared/gameModes.js';
import styles from './Game.module.css';

const other = (color) => (color === 'white' ? 'black' : 'white');
const capitalise = (text) => text[0].toUpperCase() + text.slice(1);

function summaryOf({ rated, category, tc }) {
  const name = CATEGORIES.find((entry) => entry.id === category)?.name;
  return [rated ? 'Rated' : 'Casual', formatTimeControl(tc), name].filter(Boolean).join(' · ');
}

// Date.now(), refreshed every 250 ms while `active`.
function useNow(active) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return undefined;
    setNow(Date.now());
    const timer = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(timer);
  }, [active]);
  return now;
}

function Header({ summary }) {
  return (
    <div className={styles.header}>
      <Link to="/play" className={styles.back}>
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M15 5l-7 7 7 7" />
        </svg>
        Play
      </Link>
      {summary && <p className={styles.summary}>{summary}</p>}
    </div>
  );
}

// player: { guest?, username (null once deleted), avatar, rating, provisional? }
function GamePlayer({ player, color, fen, clock, active, diff }) {
  const deleted = !player.guest && !player.username;
  return (
    <PlayerBar
      name={deleted ? 'Deleted user' : player.username}
      username={player.guest || deleted ? undefined : player.username}
      avatar={<Avatar id={player.avatar} deleted={deleted} />}
      rating={player.rating ?? undefined}
      provisional={Boolean(player.provisional)}
      ratingDiff={diff ?? undefined}
      material={<MaterialDiff fen={fen} color={color} />}
      clock={clock}
      active={active}
    />
  );
}

const ratingList = (players, diffs) =>
  diffs
    ? ['white', 'black'].map((color) => ({ name: players[color].username ?? 'Deleted user', diff: diffs[color] }))
    : undefined;

function Prompt({ children, actions }) {
  return (
    <div className={styles.prompt} role="status">
      <p>{children}</p>
      {actions && <div className={styles.promptActions}>{actions}</div>}
    </div>
  );
}

function LiveGame({ game }) {
  const { settings } = useSettings();
  const navigate = useNavigate();
  const [orientation, setOrientation] = useState(game.role);
  const playing = game.status === 'playing';
  const opponent = other(game.role);
  const now = useNow(playing);

  useEffect(() => {
    document.title = game.myTurn ? 'Your turn · Chesscube' : 'Game · Chesscube';
  }, [game.myTurn]);
  useEffect(() => () => {
    document.title = 'Chesscube';
  }, []);

  const lowTime = useCallback(() => {
    if (settings.sounds) playSound('lowTime', settings.soundTheme);
  }, [settings.sounds, settings.soundTheme]);

  const bar = (color) => (
    <GamePlayer
      player={game.players[color]}
      color={color}
      fen={game.fen}
      diff={game.ratingDiffs?.[color]}
      active={playing && game.sideToMove === color}
      clock={
        <Clock
          ms={game.clocks[color]}
          running={game.clockColor === color}
          syncedAt={game.syncedAt}
          onLowTime={color === game.role ? lowTime : undefined}
        />
      }
    />
  );

  const prompts = [];
  if (playing && game.moves.length < 2 && game.firstMoveDeadline) {
    const mover = game.moves.length === 0 ? 'white' : 'black';
    const seconds = Math.max(0, Math.ceil((game.firstMoveDeadline - now) / 1000));
    prompts.push(
      <Prompt key="first">
        {mover === game.role
          ? `You have ${seconds} s to make your first move`
          : `${capitalise(mover)} has ${seconds} s to make the first move`}
      </Prompt>
    );
  }
  const claimAt = game.claimAt[opponent];
  if (playing && claimAt && game.moves.length >= 2) {
    const wait = Math.ceil((claimAt - now) / 1000);
    prompts.push(
      wait > 0 ? (
        <Prompt key="gone">Your opponent left the game. You can claim it in {wait} s.</Prompt>
      ) : (
        <Prompt
          key="gone"
          actions={
            <>
              <Button size="sm" onClick={game.claimVictory}>
                Claim victory
              </Button>
              <Button size="sm" variant="secondary" onClick={game.claimDraw}>
                Call it a draw
              </Button>
            </>
          }
        >
          Your opponent left the game.
        </Prompt>
      )
    );
  }
  if (playing && game.drawOffer === opponent) {
    prompts.push(
      <Prompt
        key="draw"
        actions={
          <>
            <Button size="sm" onClick={() => game.respondDraw(true)}>
              Accept draw
            </Button>
            <Button size="sm" variant="secondary" onClick={() => game.respondDraw(false)}>
              Decline
            </Button>
          </>
        }
      >
        Your opponent offers a draw.
      </Prompt>
    );
  } else if (playing && game.drawOffer === game.role) {
    prompts.push(<Prompt key="draw">Draw offered. Waiting for your opponent…</Prompt>);
  }

  const rematch =
    game.rematchOffer === opponent ? (
      <>
        <Button onClick={() => game.respondRematch(true)}>Accept rematch</Button>
        <Button variant="ghost" onClick={() => game.respondRematch(false)}>
          Decline
        </Button>
      </>
    ) : (
      <Button onClick={game.offerRematch} disabled={game.rematchOffer === game.role}>
        {game.rematchOffer === game.role ? 'Rematch offered…' : 'Rematch'}
      </Button>
    );

  return (
    <>
      <Header summary={summaryOf(game)} />
      <GameView
        label="Online game"
        board={
          <InteractiveBoard
            id="online-board"
            fen={game.fen}
            orientation={orientation}
            movableColor={playing ? game.role : null}
            turn={game.turn}
            dests={game.dests}
            lastMove={game.lastMove}
            check={game.check}
            onMove={game.move}
            viewOnly={!playing || !game.atLatest}
            premove={game.premove}
            onPremove={settings.premoves ? game.setPremove : undefined}
            onCancelPremove={game.cancelPremove}
            variant={game.variant}
          />
        }
        topBar={bar(other(orientation))}
        bottomBar={bar(orientation)}
        moveList={<MoveList moves={game.moves} viewPly={game.viewPly} onSelect={game.setViewPly} />}
        prompt={prompts.length > 0 && <div className={styles.prompts}>{prompts}</div>}
        controls={
          playing && (
            <GameControls
              canAbort={game.moves.length < 2}
              onAbort={game.abort}
              canOfferDraw={game.moves.length >= 2 && !game.drawOffer && game.drawOffersLeft > 0}
              onOfferDraw={game.offerDraw}
              canResign={game.moves.length >= 2}
              onResign={game.resign}
              onFlip={() => setOrientation(other)}
            />
          )
        }
        result={
          !playing && (
            <GameResult
              result={game.result}
              termination={game.termination}
              ratings={ratingList(game.players, game.ratingDiffs)}
              actions={
                <>
                  {rematch}
                  <Button
                    variant="secondary"
                    onClick={() =>
                      navigate('/play', { state: { newGame: { variant: game.variant, base: game.tc.base, inc: game.tc.inc, rated: game.rated } } })
                    }
                  >
                    New game
                  </Button>
                  {game.moves.length > 0 && (
                    <Button
                      as={Link}
                      variant="secondary"
                      to="/learn/analysis"
                      state={{ variant: game.variant, initialFen: game.startFen, moves: game.moves.map((move) => move.uci), orientation }}
                    >
                      Analyse
                    </Button>
                  )}
                </>
              }
            />
          )
        }
        onNavigate={(action) => game.setViewPly(navigatePly(action, game.viewPly, game.moves.length))}
        viewingHistory={!game.atLatest}
        onBackToGame={() => game.setViewPly(game.moves.length)}
      />
    </>
  );
}

// A stored game: board and moves to step through, no clocks or controls.
function Replay({ game }) {
  const { user } = useAuth();
  const ownColor = ['white', 'black'].find((color) => user && game[color].username === user.username);
  const [orientation, setOrientation] = useState(ownColor ?? 'white');

  const { startFen, moves } = useMemo(() => {
    const fen = game.initialFen ?? INITIAL_FEN;
    const pos = positionFromFen(fen);
    const played = [];
    for (const uci of game.moves) {
      const move = applyMove(pos, uci, game.variant);
      if (!move) break;
      played.push(move);
    }
    return { startFen: fen, moves: played };
  }, [game]);
  const [viewPly, setViewPly] = useState(moves.length);

  const fen = viewPly === 0 ? startFen : moves[viewPly - 1].fen;
  const lastUci = viewPly === 0 ? null : moves[viewPly - 1].uci;

  useEffect(() => {
    const names = ['white', 'black'].map((color) => game[color].username ?? 'Deleted user');
    document.title = `${names.join(' vs ')} · Chesscube`;
    return () => {
      document.title = 'Chesscube';
    };
  }, [game]);

  const bar = (color) => <GamePlayer player={game[color]} color={color} fen={fen} diff={game[color].diff} />;

  return (
    <>
      <Header summary={summaryOf(game)} />
      <GameView
        label="Finished game"
        board={
          <InteractiveBoard
            id="replay-board"
            fen={fen}
            orientation={orientation}
            lastMove={lastUci ? [lastUci.slice(0, 2), lastUci.slice(2, 4)] : null}
            viewOnly
            variant={game.variant}
          />
        }
        topBar={bar(other(orientation))}
        bottomBar={bar(orientation)}
        moveList={<MoveList moves={moves} viewPly={viewPly} onSelect={setViewPly} />}
        controls={
          <div className={styles.replayControls}>
            <Button variant="secondary" size="sm" onClick={() => setOrientation(other)}>
              Flip board
            </Button>
          </div>
        }
        result={
          <GameResult
            result={game.result}
            termination={game.termination}
            ratings={game.rated ? ratingList(game, { white: game.white.diff ?? 0, black: game.black.diff ?? 0 }) : undefined}
            actions={
              <Button as={Link} to={`/learn/analysis/${game.id}`}>
                Analyse
              </Button>
            }
          />
        }
        onNavigate={(action) => setViewPly(navigatePly(action, viewPly, moves.length))}
      />
    </>
  );
}

// Not a live game this player can join: try the stored record.
function StoredGame({ id, code }) {
  const [state, setState] = useState({ status: 'loading' });

  useEffect(() => {
    const controller = new AbortController();
    api
      .get(`/games/${encodeURIComponent(id)}`, { signal: controller.signal })
      .then((data) => setState({ status: 'ready', game: data.game }))
      .catch((err) => {
        if (err.name === 'AbortError') return;
        setState({ status: err.status === 409 ? 'live' : err.status === 404 ? 'notfound' : 'error', message: err.message });
      });
    return () => controller.abort();
  }, [id]);

  if (state.status === 'loading') return <Loading />;
  if (state.status === 'ready') return <Replay game={state.game} />;

  const copy = {
    live: {
      title: 'This game is still being played',
      text: code === 'NOT_PLAYER' ? 'Only the two players can open a live game for now.' : 'Come back when it has finished to replay it.',
    },
    notfound: { title: 'Game not found', text: "This game doesn't exist, was aborted, or was a guest game that has ended." },
    error: { title: "Couldn't load this game", text: state.message },
  }[state.status];

  return (
    <EmptyState
      className={styles.message}
      title={copy.title}
      text={copy.text}
      action={
        <Button as={Link} to="/play">
          Play a game
        </Button>
      }
    />
  );
}

function Loading() {
  return (
    <div className={styles.loading}>
      <Spinner label="Loading the game" />
    </div>
  );
}

function GameScreen({ id }) {
  const game = useOnlineGame(id);
  if (game.phase === 'live') return <LiveGame game={game} />;
  if (game.phase === 'unavailable') return <StoredGame id={id} code={game.code} />;
  return <Loading />;
}

// /game/:id — a live game for its players, or the finished game's replay for anyone.
export default function Game() {
  const { id } = useParams();
  return (
    <div className="page">
      <h1 className="sr-only">Game</h1>
      <GameScreen key={id} id={id} />
    </div>
  );
}
