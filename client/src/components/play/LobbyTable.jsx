import { formatTimeControl, VARIANTS } from '../../shared/gameModes.js';
import Avatar from '../Avatar.jsx';
import Button from '../ui/Button.jsx';
import EmptyState from '../ui/EmptyState.jsx';
import styles from './LobbyTable.module.css';

const variantName = (id) => VARIANTS.find((variant) => variant.id === id)?.name ?? id;

// Open custom games. Seeks look like { id, player: { username, avatar } | null (guest), rating, provisional, base, inc, rated, variant }.
export default function LobbyTable({ seeks = [], onAccept, onCancel, ownSeekId, onCreate }) {
  if (seeks.length === 0) {
    return (
      <div className={styles.empty}>
        <EmptyState
          icon={
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="9" cy="9" r="3.2" />
              <path d="M3.5 19a5.5 5.5 0 0 1 11 0M15.5 6.2a3 3 0 0 1 0 5.6M17.5 14.2a5.5 5.5 0 0 1 3 4.8" />
            </svg>
          }
          title="No open games right now"
          text="Create a custom game and wait here for someone to accept it."
          action={<Button onClick={onCreate}>Create a game</Button>}
        />
      </div>
    );
  }

  return (
    <div className={styles.scroll}>
      <table className={styles.table}>
        <thead>
          <tr>
            <th scope="col">Player</th>
            <th scope="col" className={styles.rating}>
              Rating
            </th>
            <th scope="col">Time</th>
            <th scope="col">Mode</th>
            <th scope="col">Variant</th>
          </tr>
        </thead>
        <tbody>
          {seeks.map((seek) => {
            const own = seek.id === ownSeekId;
            const name = seek.player?.username ?? 'Guest';
            const time = formatTimeControl(seek);
            const label = own ? `Cancel your ${time} game` : `Accept ${time} game from ${name}`;
            return (
              <tr key={seek.id} className={own ? styles.own : undefined}>
                <td>
                  <button
                    type="button"
                    className={styles.rowButton}
                    aria-label={label}
                    onClick={() => (own ? onCancel?.(seek) : onAccept?.(seek))}
                  />
                  <span className={styles.player}>
                    <Avatar id={seek.player?.avatar} size={28} />
                    <span className={styles.name}>{name}</span>
                    {own && <span className={styles.ownTag}>Cancel</span>}
                  </span>
                </td>
                <td className={styles.rating}>
                  {seek.rating ? `${seek.rating}${seek.provisional ? '?' : ''}` : '—'}
                </td>
                <td className={styles.time}>{time}</td>
                <td>{seek.rated ? 'Rated' : 'Casual'}</td>
                <td>{variantName(seek.variant)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
