import { CATEGORIES } from '../../shared/gameModes.js';
import CategoryIcon from '../icons/CategoryIcon.jsx';
import card from './Card.module.css';
import styles from './RatingsCard.module.css';

const ROWS = [...CATEGORIES, { id: 'puzzle', name: 'Puzzles' }];

const plural = (n, word) => `${n.toLocaleString()} ${word}${n === 1 ? '' : 's'}`;

export default function RatingsCard({ user }) {
  return (
    <section className={card.card} aria-labelledby="ratings-title">
      <h2 id="ratings-title" className={card.title}>
        Ratings
      </h2>
      <ul className={styles.list}>
        {ROWS.map(({ id, name }) => {
          const { rating = 0, games = 0, provisional = true } = user.ratings?.[id] ?? {};
          const isPuzzle = id === 'puzzle';
          return (
            <li key={id} className={styles.row}>
              <span className={styles.icon}>
                <CategoryIcon category={id} />
              </span>
              <span className={styles.name}>
                {name}
                {isPuzzle && (
                  <span className={styles.streak}>
                    Daily streak {user.puzzle?.streak ?? 0} · best {user.puzzle?.best ?? 0}
                  </span>
                )}
              </span>
              <span className={styles.rating}>
                {rating}
                {provisional && (
                  <span className={styles.provisional} title="Provisional rating: not enough games yet">
                    ?<span className="sr-only"> (provisional)</span>
                  </span>
                )}
              </span>
              <span className={styles.games}>{plural(games, isPuzzle ? 'puzzle' : 'game')}</span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
