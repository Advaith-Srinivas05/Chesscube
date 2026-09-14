import { useEffect, useState } from 'react';
import Button from '../ui/Button.jsx';
import Dialog from '../ui/Dialog.jsx';
import GameSettingsFields, { DEFAULT_GAME_SETTINGS } from './GameSettingsFields.jsx';

// Custom lobby game. "Create game" only closes the dialog until the lobby exists (plan 10.7).
export default function CreateGameDialog({ open, onClose, onCreate }) {
  const [settings, setSettings] = useState(DEFAULT_GAME_SETTINGS);

  useEffect(() => {
    if (open) setSettings(DEFAULT_GAME_SETTINGS);
  }, [open]);

  function handleCreate() {
    onCreate?.(settings);
    onClose();
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Create a game"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleCreate}>Create game</Button>
        </>
      }
    >
      <GameSettingsFields value={settings} onChange={setSettings} />
    </Dialog>
  );
}
