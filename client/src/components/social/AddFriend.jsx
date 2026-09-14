import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { friendsApi } from '../../lib/friends.js';
import Avatar from '../Avatar.jsx';
import Button from '../ui/Button.jsx';
import Field from '../ui/Field.jsx';
import Spinner from '../ui/Spinner.jsx';
import styles from './Social.module.css';

const DEBOUNCE_MS = 300;
const MIN_LENGTH = 2;

function CheckIcon() {
  return (
    <svg viewBox="0 0 24 24" className={styles.check} aria-hidden="true">
      <path d="M5 12.5l4.5 4.5L19 7.5" />
    </svg>
  );
}

// `relationOf(username)` comes from the Socials lists, so buttons follow actions taken anywhere on the page.
export default function AddFriend({ relationOf, onAdd, onAccept, isBusy }) {
  const [query, setQuery] = useState('');
  const [search, setSearch] = useState({ state: 'idle', q: '', users: [] });
  const q = query.trim();

  useEffect(() => {
    if (q.length < MIN_LENGTH) {
      setSearch({ state: 'idle', q, users: [] });
      return undefined;
    }
    const controller = new AbortController();
    setSearch((current) => ({ ...current, state: 'loading' }));
    const timer = setTimeout(() => {
      friendsApi
        .search(q, { signal: controller.signal })
        .then((data) => setSearch({ state: 'ready', q, users: data.users }))
        .catch((err) => {
          if (err.name !== 'AbortError') setSearch({ state: 'error', q, users: [], message: err.message });
        });
    }, DEBOUNCE_MS);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [q]);

  function actionFor(result) {
    const { relation, request } = relationOf(result.username) ?? { relation: result.relation };
    const busy = isBusy(result.username);
    switch (relation) {
      case 'friends':
        return (
          <Button size="sm" variant="ghost" disabled>
            <CheckIcon />
            Friends
          </Button>
        );
      case 'outgoing':
        return (
          <Button size="sm" variant="secondary" disabled>
            Requested
          </Button>
        );
      case 'incoming':
        return (
          <Button size="sm" onClick={() => (request ? onAccept(request) : onAdd(result))} disabled={busy}>
            Accept
          </Button>
        );
      default:
        return (
          <Button size="sm" onClick={() => onAdd(result)} disabled={busy}>
            Add
          </Button>
        );
    }
  }

  const { state, users } = search;

  return (
    <section className={styles.panel} aria-labelledby="add-friend-title">
      <h2 id="add-friend-title" className={styles.heading}>
        Add a friend
      </h2>
      <form role="search" onSubmit={(event) => event.preventDefault()}>
        <Field label="Search by username">
          <input
            type="search"
            placeholder="Username"
            autoComplete="off"
            autoCapitalize="none"
            spellCheck={false}
            maxLength={20}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </Field>
      </form>

      <div aria-live="polite">
        {state === 'loading' && (
          <p className={`${styles.note} ${styles.searchStatus}`}>
            <Spinner size={16} label={null} /> Searching…
          </p>
        )}
        {state === 'error' && <p className={styles.note}>{search.message}</p>}
        {state === 'ready' && users.length === 0 && <p className={styles.note}>No players found for “{search.q}”.</p>}
        {state === 'idle' && q.length > 0 && <p className={styles.note}>Type at least {MIN_LENGTH} characters.</p>}
      </div>

      {/* Earlier results stay visible while the next search runs. */}
      {(state === 'ready' || state === 'loading') && users.length > 0 && (
        <ul className={`${styles.list} ${styles.results}`}>
          {users.map((result) => (
            <li key={result.username} className={styles.row}>
              <Avatar id={result.avatar} size={40} />
              <div className={styles.who}>
                <Link to={`/u/${result.username}`} className={styles.name}>
                  {result.username}
                </Link>
              </div>
              <div className={styles.actions}>{actionFor(result)}</div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
