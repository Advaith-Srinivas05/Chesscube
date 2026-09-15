import styles from './PlaySidebar.module.css';

const ICONS = {
  lobby: (
    <>
      <rect x="3.5" y="5" width="17" height="14" rx="2.5" />
      <path d="M12 9v6M9 12h6" />
    </>
  ),
  friend: (
    <>
      <circle cx="10" cy="8.5" r="3.5" />
      <path d="M3.5 20a6.5 6.5 0 0 1 13 0M18.5 8v6M15.5 11h6" />
    </>
  ),
  computer: (
    <>
      <rect x="6.5" y="6.5" width="11" height="11" rx="2" />
      <rect x="9.75" y="9.75" width="4.5" height="4.5" rx="0.8" />
      <path d="M9.5 3v3.5M14.5 3v3.5M9.5 17.5V21M14.5 17.5V21M3 9.5h3.5M3 14.5h3.5M17.5 9.5H21M17.5 14.5H21" />
    </>
  ),
};

function Action({ icon, label, onClick }) {
  return (
    <button type="button" className={styles.action} onClick={onClick}>
      <span className={styles.icon}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          {ICONS[icon]}
        </svg>
      </span>
      {label}
    </button>
  );
}

// `stats` ({ players, games }) is null until the game server has sent numbers.
export default function PlaySidebar({ onCreateLobby, onChallengeFriend, onPlayComputer, stats = null }) {
  const count = (value) => (value == null ? '—' : value.toLocaleString());
  const plural = (value, word) => (value === 1 ? word : `${word}s`);

  return (
    <aside className={styles.sidebar} aria-label="More ways to play">
      <div className={styles.actions}>
        <Action icon="lobby" label="Create lobby game" onClick={onCreateLobby} />
        <Action icon="friend" label="Challenge a friend" onClick={onChallengeFriend} />
        <Action icon="computer" label="Play against computer" onClick={onPlayComputer} />
      </div>
      <dl className={styles.stats}>
        <div>
          <dt className="sr-only">Players online</dt>
          <dd>
            <span className={styles.number}>{count(stats?.players)}</span> {plural(stats?.players, 'player')} online
          </dd>
        </div>
        <div>
          <dt className="sr-only">Games in play</dt>
          <dd>
            <span className={styles.number}>{count(stats?.games)}</span> {plural(stats?.games, 'game')} in play
          </dd>
        </div>
      </dl>
    </aside>
  );
}
