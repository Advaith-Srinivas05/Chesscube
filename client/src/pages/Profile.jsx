import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import MatchHistory from '../components/MatchHistory.jsx';
import card from '../components/profile/Card.module.css';
import DetailsCard from '../components/profile/DetailsCard.jsx';
import RatingsCard from '../components/profile/RatingsCard.jsx';
import Button from '../components/ui/Button.jsx';
import EmptyState from '../components/ui/EmptyState.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { api } from '../lib/api.js';
import styles from './Profile.module.css';

// /profile (signed in) and /u/:username (anyone). Your own profile always comes from the auth state.
export default function Profile() {
  const { username: routeName } = useParams();
  const { user, status: authStatus } = useAuth();
  const navigate = useNavigate();
  const isOwn = Boolean(user) && (!routeName || routeName.toLowerCase() === user.username.toLowerCase());
  const [remote, setRemote] = useState({ status: 'loading', user: null, name: null });
  const [attempt, setAttempt] = useState(0);

  const fetchName = !isOwn && routeName && authStatus === 'ready' ? routeName : null;

  useEffect(() => {
    if (!fetchName) return undefined;
    const controller = new AbortController();
    setRemote({ status: 'loading', user: null, name: fetchName });
    api
      .get(`/users/${encodeURIComponent(fetchName)}`, { signal: controller.signal })
      .then((data) => setRemote({ status: 'ready', user: data.user, name: fetchName }))
      .catch((err) => {
        if (err.name === 'AbortError') return;
        setRemote({ status: err.status === 404 ? 'notfound' : 'error', user: null, name: fetchName, message: err.message });
      });
    return () => controller.abort();
  }, [fetchName, attempt]);

  const profile = isOwn ? user : remote.name === fetchName && remote.status === 'ready' ? remote.user : null;
  const state = isOwn ? 'ready' : remote.name === fetchName ? remote.status : 'loading';

  useEffect(() => {
    const title = profile?.username ?? (state === 'notfound' ? 'Player not found' : null);
    document.title = title ? `${title} · Chesscube` : 'Chesscube';
    return () => {
      document.title = 'Chesscube';
    };
  }, [profile?.username, state]);

  // After a rename, keep /u/<name> pointing at the new name.
  function handleSaved(updated) {
    if (routeName && updated.username !== routeName) navigate(`/u/${updated.username}`, { replace: true });
  }

  if (state === 'notfound' || state === 'error') {
    const notFound = state === 'notfound';
    return (
      <div className="page">
        <section className={`${card.card} ${styles.message}`}>
          <EmptyState
            title={notFound ? 'Player not found' : "Couldn't load this profile"}
            text={notFound ? `No one goes by “${routeName}”. Check the spelling and try again.` : remote.message}
            action={
              notFound ? (
                <Button as={Link} to="/" variant="secondary">
                  Back home
                </Button>
              ) : (
                <Button variant="secondary" onClick={() => setAttempt((n) => n + 1)}>
                  Try again
                </Button>
              )
            }
          />
        </section>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="page">
        <div className={styles.grid} aria-busy="true">
          <span className="sr-only" role="status">
            Loading profile
          </span>
          <div className={`${card.card} ${styles.skeleton}`} style={{ height: 300 }} />
          <div className={`${card.card} ${styles.skeleton}`} style={{ height: 300 }} />
          <div className={`${card.card} ${styles.skeleton} ${styles.wide}`} style={{ height: 220 }} />
        </div>
      </div>
    );
  }

  return (
    <div className="page">
      <h1 className="sr-only">{isOwn ? 'Your profile' : `${profile.username}'s profile`}</h1>
      <div className={styles.grid}>
        <DetailsCard user={profile} isOwn={isOwn} onSaved={handleSaved} />
        <RatingsCard user={profile} />
        <div className={styles.wide}>
          <MatchHistory username={profile.username} isOwn={isOwn} />
        </div>
      </div>
    </div>
  );
}
