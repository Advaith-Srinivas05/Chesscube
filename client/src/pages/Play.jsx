import { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import ChallengeFriendDialog from '../components/play/ChallengeFriendDialog.jsx';
import ComputerGameDialog from '../components/play/ComputerGameDialog.jsx';
import CreateGameDialog from '../components/play/CreateGameDialog.jsx';
import LobbyTable from '../components/play/LobbyTable.jsx';
import PairingGrid from '../components/play/PairingGrid.jsx';
import PlaySidebar from '../components/play/PlaySidebar.jsx';
import Button from '../components/ui/Button.jsx';
import Spinner from '../components/ui/Spinner.jsx';
import Tabs, { TabPanel } from '../components/ui/Tabs.jsx';
import { useToast } from '../components/ui/Toast.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { withNext } from '../hooks/useNextPath.js';
import useSocket from '../hooks/useSocket.js';
import useSocketEvent from '../hooks/useSocketEvent.js';
import { request, socket } from '../lib/socket.js';
import { categoryFor, CATEGORIES, formatTimeControl, QUICK_PAIRINGS, VARIANTS } from '../shared/gameModes.js';
import styles from './Play.module.css';

const TABS = [
  { value: 'quick', label: 'Quick pairing' },
  { value: 'lobby', label: 'Lobby' },
];

// Subscribes to a server room while `active`: `subscribe` resolves with the ack, `unsubscribe` runs on cleanup.
function useSubscription(active, subscribeEvent, unsubscribeEvent, onAck) {
  const ackRef = useRef(onAck);
  ackRef.current = onAck;
  useEffect(() => {
    if (!active) return undefined;
    request(subscribeEvent).then((response) => response.ok && ackRef.current(response));
    return () => {
      if (socket.connected) request(unsubscribeEvent);
    };
  }, [active, subscribeEvent, unsubscribeEvent]);
}

// "3+2 · Blitz · Rated", plus the variant when it isn't standard.
function seekSummary(seek) {
  const category = CATEGORIES.find((entry) => entry.id === categoryFor(seek))?.name;
  const variant = seek.variant === 'standard' ? null : VARIANTS.find((entry) => entry.id === seek.variant)?.name;
  return [formatTimeControl(seek), variant ?? category, seek.rated ? 'Rated' : 'Casual'].join(' · ');
}

export default function Play() {
  const { user } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  const { connected, identity, activeGameId, ownSeek } = useSocket();
  const [params, setParams] = useSearchParams();
  const tab = params.get('tab') === 'lobby' ? 'lobby' : 'quick';
  const [dialog, setDialog] = useState(null);
  const [createInitial, setCreateInitial] = useState(null);
  const [stats, setStats] = useState(null);
  const [seekList, setSeekList] = useState([]);
  const close = () => setDialog(null);

  function changeTab(value) {
    setParams(value === 'lobby' ? { tab: 'lobby' } : {}, { replace: true });
  }

  useSocketEvent('game:start', ({ id }) => navigate(`/game/${id}`));

  const toStats = ({ online, games }) => ({ players: online, games });
  useSubscription(connected, 'play:subscribe', 'play:unsubscribe', (response) => setStats(toStats(response.stats)));
  useSocketEvent('stats', (data) => setStats(toStats(data)));

  useSubscription(connected && tab === 'lobby', 'lobby:subscribe', 'lobby:unsubscribe', (response) => setSeekList(response.seeks));
  useSocketEvent('lobby:added', (seek) => setSeekList((current) => [...current.filter((entry) => entry.id !== seek.id), seek]));
  useSocketEvent('lobby:removed', ({ id }) => setSeekList((current) => current.filter((entry) => entry.id !== id)));

  function ready() {
    if (!connected) {
      toast.show('Still connecting to the server, try again in a moment');
      return false;
    }
    if (activeGameId) {
      toast.show('Finish your current game first', { tone: 'danger' });
      return false;
    }
    return true;
  }

  // A quick pairing tile joins an open lobby game with that time control, or opens one.
  async function quickPair(presetId) {
    const response = await request('lobby:quick', { presetId });
    // A match navigates through game:start.
    if (!response.ok) toast.show(response.message, { tone: 'danger' });
  }

  function cancelSeek() {
    request('lobby:cancel');
  }

  function handleSelect(preset) {
    if (ownSeek?.presetId === preset.id) {
      cancelSeek();
      return;
    }
    if (ready()) quickPair(preset.id);
  }

  async function handleCreate({ variant, base, inc, rated, color }) {
    if (!ready()) return;
    const response = await request('lobby:create', { variant, base, inc, rated: Boolean(user) && rated, color });
    if (!response.ok) {
      toast.show(response.message, { tone: 'danger' });
      return;
    }
    changeTab('lobby');
  }

  async function handleAccept(seek) {
    if (!ready()) return;
    const response = await request('lobby:accept', { seekId: seek.id });
    // Success navigates through game:start.
    if (!response.ok) toast.show(response.message, { tone: 'danger' });
  }

  function openCreate(initial = null) {
    setCreateInitial(initial);
    setDialog('create');
  }

  // "New game" from a finished game: search the same quick pairing again, or reopen those settings.
  const newGame = location.state?.newGame;
  useEffect(() => {
    if (!newGame || !connected) return;
    navigate(location.pathname + location.search, { replace: true, state: null });
    const preset = QUICK_PAIRINGS.find(({ base, inc }) => base === newGame.base && inc === newGame.inc);
    const quickFits = preset && newGame.variant === 'standard' && newGame.rated === Boolean(user);
    if (quickFits) {
      changeTab('quick');
      if (ready()) quickPair(preset.id);
    } else {
      openCreate({ variant: newGame.variant, base: newGame.base, inc: newGame.inc, rated: newGame.rated });
    }
  }, [newGame, connected]);

  // `?pair=5+3` (Home's quick tiles): start searching that preset once connected, then drop the param.
  const pairId = params.get('pair');
  useEffect(() => {
    if (!pairId || !connected || identity === null) return;
    setParams(tab === 'lobby' ? { tab: 'lobby' } : {}, { replace: true });
    const preset = QUICK_PAIRINGS.find(({ id }) => id === pairId);
    if (!preset || ownSeek?.presetId === preset.id) return;
    if (ready()) quickPair(preset.id);
  }, [pairId, connected, identity]);

  // Your own seek pinned on top, then newest first.
  const ownSeekId = ownSeek?.id ?? null;
  const own = (seek) => (seek.id === ownSeekId ? 1 : 0);
  const seeks = [...seekList].sort((a, b) => own(b) - own(a) || b.createdAt - a.createdAt);

  return (
    <div className={`page ${styles.play}`}>
      <h1 className="sr-only">Play</h1>
      <Tabs id="play" label="Game type" items={TABS} value={tab} onChange={changeTab} className={styles.tabs} />

      <div className={styles.main}>
        {activeGameId && (
          <div className={styles.resume} role="status">
            <p>You have a game in progress.</p>
            <Button as={Link} to={`/game/${activeGameId}`} size="sm">
              Resume
            </Button>
          </div>
        )}
        {ownSeek && !activeGameId && (
          <div className={styles.waiting} role="status">
            <Spinner size={16} label={null} />
            <p>
              Waiting for an opponent · <strong>{seekSummary(ownSeek)}</strong>
            </p>
            <Button variant="secondary" size="sm" onClick={cancelSeek}>
              Cancel
            </Button>
          </div>
        )}
        {!user && identity?.kind === 'guest' && (
          <p className={styles.guestNote}>
            Playing as <strong>{identity.username}</strong> · casual games against other guests.{' '}
            <Link to={withNext('/signin', '/play')}>Sign in</Link> for rated games.
          </p>
        )}

        <TabPanel tabsId="play" value={tab} className={styles.panel}>
          {tab === 'lobby' ? (
            <LobbyTable
              seeks={seeks}
              ownSeekId={ownSeekId}
              onAccept={handleAccept}
              onCancel={cancelSeek}
              onCreate={() => openCreate()}
            />
          ) : (
            <PairingGrid onSelect={handleSelect} onCustom={() => openCreate()} searchingId={ownSeek?.presetId} />
          )}
        </TabPanel>
      </div>

      <div className={styles.sidebar}>
        <PlaySidebar
          onCreateLobby={() => openCreate()}
          onChallengeFriend={() => setDialog('friend')}
          onPlayComputer={() => setDialog('computer')}
          stats={stats}
        />
      </div>

      <CreateGameDialog open={dialog === 'create'} onClose={close} onCreate={handleCreate} initial={createInitial} />
      <ChallengeFriendDialog open={dialog === 'friend'} onClose={close} />
      <ComputerGameDialog open={dialog === 'computer'} onClose={close} />
    </div>
  );
}
