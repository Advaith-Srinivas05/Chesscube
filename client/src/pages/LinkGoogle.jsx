import { useState } from 'react';
import { Link, Navigate, useLocation } from 'react-router-dom';
import { GOOGLE_LINK_KEY } from '../components/GoogleButton.jsx';
import PasswordField from '../components/PasswordField.jsx';
import Button from '../components/ui/Button.jsx';
import { useToast } from '../components/ui/Toast.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { useNextPath, withNext } from '../hooks/useNextPath.js';
import styles from './Auth.module.css';

function readLink(state) {
  if (state?.linkToken) return state;
  try {
    return JSON.parse(sessionStorage.getItem(GOOGLE_LINK_KEY) ?? 'null');
  } catch {
    return null;
  }
}

function clearLink() {
  try {
    sessionStorage.removeItem(GOOGLE_LINK_KEY);
  } catch {
    // ignore
  }
}

// Continue with Google found an existing account for the same email, and Google can't vouch for that address
// (it isn't Gmail or a Workspace account), so the account's password is confirmed once before linking.
export default function LinkGoogle() {
  const { linkGoogle } = useAuth();
  const toast = useToast();
  const next = useNextPath();
  const location = useLocation();
  const [link] = useState(() => readLink(location.state));
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  if (!link?.linkToken) return <Navigate to={withNext('/signin', next)} replace />;

  async function handleSubmit(event) {
    event.preventDefault();
    if (!password) {
      setError({ message: 'Enter your password' });
      return;
    }
    setError(null);
    setLoading(true);
    try {
      const { user } = await linkGoogle(link.linkToken, password);
      clearLink();
      toast.show(`Google linked. Welcome back, ${user.username}`, { tone: 'success' });
      // GuestOnly moves on to ?next= now that the user is set.
    } catch (err) {
      setLoading(false);
      setError({ message: err.message, expired: err.code === 'LINK_EXPIRED' });
      if (err.code === 'LINK_EXPIRED') clearLink();
    }
  }

  return (
    <div className={`page ${styles.page}`}>
      <section className={styles.card}>
        <h1 className={styles.title}>Link Google</h1>
        <p className={styles.subtitle}>
          <strong>{link.email}</strong> already has a Chesscube account. Enter its password once to sign in with Google
          from now on.
        </p>

        <form className={styles.form} onSubmit={handleSubmit} noValidate>
          {error && (
            <p className={styles.alert} role="alert">
              {error.message}
              {error.expired && (
                <>
                  {' '}
                  <Link to={withNext('/signin', next)}>Back to sign in</Link>
                </>
              )}
            </p>
          )}
          <PasswordField
            name="password"
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            autoFocus
          />
          <div className={styles.labelRow}>
            <Link to="/forgot-password" className={styles.link}>
              Forgot password?
            </Link>
          </div>
          <Button type="submit" size="lg" loading={loading} className={styles.submit}>
            Link and sign in
          </Button>
        </form>

        <p className={styles.footer}>
          Not your account?{' '}
          <Link to={withNext('/signin', next)} className={styles.link} onClick={clearLink}>
            Back to sign in
          </Link>
        </p>
      </section>
    </div>
  );
}
