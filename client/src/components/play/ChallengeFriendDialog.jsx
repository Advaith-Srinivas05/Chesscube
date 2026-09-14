import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';
import { withNext } from '../../hooks/useNextPath.js';
import Button from '../ui/Button.jsx';
import Dialog from '../ui/Dialog.jsx';
import EmptyState from '../ui/EmptyState.jsx';
import GameSettingsFields, { DEFAULT_GAME_SETTINGS } from './GameSettingsFields.jsx';
import styles from './PlayDialogs.module.css';

const friendIcon = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="10" cy="8.5" r="3.5" />
    <path d="M3.5 20a6.5 6.5 0 0 1 13 0M18.5 8v6M15.5 11h6" />
  </svg>
);

// Friends load here once challenges exist (plan 11.3); until then the picker is a placeholder.
export default function ChallengeFriendDialog({ open, onClose }) {
  const { user } = useAuth();
  const [settings, setSettings] = useState(DEFAULT_GAME_SETTINGS);

  useEffect(() => {
    if (open) setSettings(DEFAULT_GAME_SETTINGS);
  }, [open]);

  if (!user) {
    return (
      <Dialog open={open} onClose={onClose} title="Challenge a friend">
        <EmptyState
          icon={friendIcon}
          title="Sign in to challenge friends"
          text="Friends and challenges need an account. Signing up is free and only takes a minute."
          action={
            <Button as={Link} to={withNext('/signin', '/play')}>
              Sign in
            </Button>
          }
        />
      </Dialog>
    );
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Challenge a friend"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={onClose}>Send challenge</Button>
        </>
      }
    >
      <div className={styles.stack}>
        <section className={styles.picker} aria-label="Friend">
          <EmptyState
            icon={friendIcon}
            title="No friends to challenge yet"
            text="Add friends in Socials to challenge them."
            action={
              <Button as={Link} to="/socials" variant="secondary" size="sm">
                Go to Socials
              </Button>
            }
          />
        </section>
        <GameSettingsFields value={settings} onChange={setSettings} />
      </div>
    </Dialog>
  );
}
