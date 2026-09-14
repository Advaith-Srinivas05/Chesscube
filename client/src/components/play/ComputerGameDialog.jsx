import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { COMPUTER_LEVELS, computerGamePath, DEFAULT_COMPUTER_GAME } from '../../data/computerGame.js';
import Button from '../ui/Button.jsx';
import Dialog from '../ui/Dialog.jsx';
import GameSettingsFields, { DEFAULT_GAME_SETTINGS, Segmented } from './GameSettingsFields.jsx';
import styles from './PlayDialogs.module.css';

const LEVEL_OPTIONS = COMPUTER_LEVELS.map(({ level }) => ({ id: level, name: String(level) }));

// Computer game config ({ level, variant, color, tc }) → dialog form values.
function toForm(config) {
  const { level, variant, color, tc } = { ...DEFAULT_COMPUTER_GAME, ...config };
  return {
    ...DEFAULT_GAME_SETTINGS,
    level,
    variant,
    color,
    unlimited: !tc,
    ...(tc ? { base: tc.base, inc: tc.inc } : {}),
  };
}

// Choose a level and game settings, then start at /play/computer (the URL keeps the settings for refreshes).
export default function ComputerGameDialog({ open, onClose, initial }) {
  const navigate = useNavigate();
  const [form, setForm] = useState(() => toForm(initial));

  useEffect(() => {
    if (open) setForm(toForm(initial));
    // Reset only when the dialog opens.
  }, [open]);

  function handleStart() {
    const { level, variant, color, unlimited, base, inc } = form;
    onClose();
    navigate(computerGamePath({ level, variant, color, tc: unlimited ? null : { base, inc } }));
  }

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
          <Button onClick={handleStart}>Start game</Button>
        </>
      }
    >
      <div className={styles.stack}>
        <div className={styles.field}>
          <span className={styles.label}>Level</span>
          <Segmented
            label="Computer level"
            compact
            options={LEVEL_OPTIONS}
            value={form.level}
            onChange={(level) => setForm((current) => ({ ...current, level }))}
          />
          <p className={styles.hint}>Level 1 is gentle; level 8 plays close to full strength.</p>
        </div>
        <GameSettingsFields value={form} onChange={setForm} showRated={false} allowUnlimited />
      </div>
    </Dialog>
  );
}
