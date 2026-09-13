import { useState } from 'react';
import { Link, Navigate, useLocation } from 'react-router-dom';
import { GOOGLE_SIGNUP_KEY } from '../components/GoogleButton.jsx';
import UsernameStatus from '../components/UsernameStatus.jsx';
import Button from '../components/ui/Button.jsx';
import Field from '../components/ui/Field.jsx';
import { useToast } from '../components/ui/Toast.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { useNextPath, withNext } from '../hooks/useNextPath.js';
import { useUsernameAvailability } from '../hooks/useUsernameAvailability.js';
import styles from './Auth.module.css';

// Router state is lost on refresh, so GoogleButton also keeps a copy in sessionStorage.
function readSignup(state) {
  if (state?.signupToken) return state;
  try {
    return JSON.parse(sessionStorage.getItem(GOOGLE_SIGNUP_KEY) ?? 'null');
  } catch {
    return null;
  }
}

function clearSignup() {
  try {
    sessionStorage.removeItem(GOOGLE_SIGNUP_KEY);
  } catch {
    // ignore
  }
}

export default function ChooseUsername() {
  const { completeGoogleSignup } = useAuth();
  const toast = useToast();
  const next = useNextPath();
  const location = useLocation();
  const [signup] = useState(() => readSignup(location.state));
  const [username, setUsername] = useState(signup?.suggestion ?? '');
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const availability = useUsernameAvailability(username);

  if (!signup?.signupToken) return <Navigate to={withNext('/signin', next)} replace />;

  async function handleSubmit(event) {
    event.preventDefault();
    if (availability.state !== 'available') return;
    setError(null);
    setLoading(true);
    try {
      const { user } = await completeGoogleSignup(signup.signupToken, username.trim());
      clearSignup();
      toast.show(`Welcome to Chesscube, ${user.username}!`, { tone: 'success' });
    } catch (err) {
      setLoading(false);
      setError({ message: err.message, field: err.field, expired: err.code === 'SIGNUP_EXPIRED' });
      if (err.code === 'SIGNUP_EXPIRED') clearSignup();
    }
  }

  return (
    <div className={`page ${styles.page}`}>
      <section className={styles.card}>
        <h1 className={styles.title}>Pick a username</h1>
        <p className={styles.subtitle}>This is how other players will see you. You're almost done.</p>

        <form className={styles.form} onSubmit={handleSubmit} noValidate>
          {error && !error.field && (
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
          <Field
            label="Username"
            error={error?.field === 'username' ? error.message : undefined}
            hint={error?.field === 'username' ? undefined : <UsernameStatus availability={availability} />}
          >
            <input
              name="username"
              autoComplete="username"
              autoCapitalize="none"
              spellCheck={false}
              maxLength={20}
              value={username}
              onChange={(event) => {
                setUsername(event.target.value);
                setError(null);
              }}
              autoFocus
            />
          </Field>
          <Button
            type="submit"
            size="lg"
            loading={loading}
            disabled={availability.state !== 'available'}
            className={styles.submit}
          >
            Finish sign-up
          </Button>
        </form>
      </section>
    </div>
  );
}
