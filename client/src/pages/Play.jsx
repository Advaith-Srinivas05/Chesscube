import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import ChallengeFriendDialog from '../components/play/ChallengeFriendDialog.jsx';
import ComputerGameDialog from '../components/play/ComputerGameDialog.jsx';
import CreateGameDialog from '../components/play/CreateGameDialog.jsx';
import LobbyTable from '../components/play/LobbyTable.jsx';
import PairingGrid from '../components/play/PairingGrid.jsx';
import PlaySidebar from '../components/play/PlaySidebar.jsx';
import Tabs, { TabPanel } from '../components/ui/Tabs.jsx';
import styles from './Play.module.css';

const TABS = [
  { value: 'quick', label: 'Quick pairing' },
  { value: 'lobby', label: 'Lobby' },
];

// Static for now: pairing, the lobby and challenges are wired up in the multiplayer phase.
export default function Play() {
  const [params, setParams] = useSearchParams();
  const tab = params.get('tab') === 'lobby' ? 'lobby' : 'quick';
  const [dialog, setDialog] = useState(null);
  const close = () => setDialog(null);

  function changeTab(value) {
    setParams(value === 'lobby' ? { tab: 'lobby' } : {}, { replace: true });
  }

  return (
    <div className={`page ${styles.play}`}>
      <h1 className="sr-only">Play</h1>
      <Tabs id="play" label="Game type" items={TABS} value={tab} onChange={changeTab} className={styles.tabs} />

      <TabPanel tabsId="play" value={tab} className={styles.panel}>
        {tab === 'lobby' ? (
          <LobbyTable seeks={[]} onCreate={() => setDialog('create')} />
        ) : (
          <PairingGrid onCustom={() => setDialog('create')} />
        )}
      </TabPanel>

      <div className={styles.sidebar}>
        <PlaySidebar
          onCreateLobby={() => setDialog('create')}
          onChallengeFriend={() => setDialog('friend')}
          onPlayComputer={() => setDialog('computer')}
        />
      </div>

      <CreateGameDialog open={dialog === 'create'} onClose={close} />
      <ChallengeFriendDialog open={dialog === 'friend'} onClose={close} />
      <ComputerGameDialog open={dialog === 'computer'} onClose={close} />
    </div>
  );
}
