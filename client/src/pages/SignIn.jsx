import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import GoogleButton, { GOOGLE_ENABLED } from '../components/GoogleButton.jsx';
import PasswordField from '../components/PasswordField.jsx';
import Button from '../components/ui/Button.jsx';
import Field from '../components/ui/Field.jsx';
import { useToast } from '../components/ui/Toast.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { useNextPath, withNext } from '../hooks/useNextPath.js';
import styles from './Auth.module.css';

export default function SignIn() {
  const { signIn } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const next = useNextPath();
  const [login, setLogin] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    setError(null);
    if (!login.trim() || !password) {
      setError({ message: 'Enter your username or email and your password' });
      return;
    }
    setLoading(true);
    try {
      const { user } = await signIn(login.trim(), password);
      toast.show(`Welcome back, ${user.username}`, { tone: 'success' });
    } catch (err) {
      setLoading(false);
      if (err.code === 'EMAIL_NOT_VERIFIED') {
        navigate(withNext(`/verify-email?email=${encodeURIComponent(err.data.email)}`, next));
        return;
      }
      setError({ message: err.message, badCredentials: err.code === 'BAD_CREDENTIALS' });
    }
  }

  return (
    <div className={`page ${styles.page}`}>
      <section className={styles.card}>
        <h1 className={styles.title}>Welcome back</h1>
        <p className={styles.subtitle}>Sign in to keep your games, ratings and puzzle streak.</p>

        <form className={styles.form} onSubmit={handleSubmit} noValidate>
          {error && (
            <p className={styles.alert} role="alert">
              {error.message}
              {error.badCredentials && GOOGLE_ENABLED && '. Signed up with Google? Use Continue with Google below.'}
            </p>
          )}
          <Field label="Username or email">
            <input
              name="login"
              autoComplete="username"
              autoCapitalize="none"
              spellCheck={false}
              value={login}
              onChange={(event) => setLogin(event.target.value)}
              autoFocus
            />
          </Field>
          <PasswordField
            name="password"
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
          <div className={styles.labelRow}>
            <Link to="/forgot-password" className={styles.link}>
              Forgot password?
            </Link>
          </div>
          <Button type="submit" size="lg" loading={loading} className={styles.submit}>
            Sign in
          </Button>
        </form>

        {GOOGLE_ENABLED && (
          <>
            <div className={styles.divider}>or</div>
            <GoogleButton next={next} onError={(message) => setError({ message })} />
          </>
        )}

        <p className={styles.footer}>
          New here?{' '}
          <Link to={withNext('/signup', next)} className={styles.link}>
            Create an account
          </Link>
        </p>
      </section>
    </div>
  );
}
