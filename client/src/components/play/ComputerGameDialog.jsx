import { useEffect, useState } from 'react';
import Button from '../ui/Button.jsx';
import Dialog from '../ui/Dialog.jsx';
import GameSettingsFields, { DEFAULT_GAME_SETTINGS } from './GameSettingsFields.jsx';

// Shell for play vs computer. Engine strength and starting the game come with plan 5.5.
export default function ComputerGameDialog({ open, onClose }) {
  const [settings, setSettings] = useState(DEFAULT_GAME_SETTINGS);

  useEffect(() => {
    if (open) setSettings(DEFAULT_GAME_SETTINGS);
  }, [open]);

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Play against computer"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={onClose}>Start game</Button>
        </>
      }
    >
      <GameSettingsFields value={settings} onChange={setSettings} showRated={false} allowUnlimited />
    </Dialog>
  );
}
