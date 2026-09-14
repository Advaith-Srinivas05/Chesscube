import { Link } from 'react-router-dom';
import card from './profile/Card.module.css';
import Button from './ui/Button.jsx';
import EmptyState from './ui/EmptyState.jsx';

// Finished games for `username`. Stays empty until games are stored (multiplayer phase).
export default function MatchHistory({ username, isOwn = false }) {
  return (
    <section className={card.card} aria-labelledby="history-title">
      <h2 id="history-title" className={card.title}>
        Match history
      </h2>
      <EmptyState
        icon={
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <rect x="4" y="3.5" width="16" height="17" rx="2.5" />
            <path d="M8 8.5h8M8 12h8M8 15.5h5" />
          </svg>
        }
        title="No games yet"
        text={isOwn ? 'Your finished games will show up here.' : `${username} hasn't finished any games yet.`}
        action={
          isOwn && (
            <Button as={Link} to="/play">
              Play a game
            </Button>
          )
        }
      />
    </section>
  );
}
