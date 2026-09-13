import { useState } from 'react';
import { Link } from 'react-router-dom';
import Button from '../components/ui/Button.jsx';
import Field from '../components/ui/Field.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import styles from './Auth.module.css';

export default function ForgotPassword() {
  const { forgotPassword } = useAuth();
  const [email, setEmail] = useState('');
  const [sentTo, setSentTo] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    const address = email.trim();
    if (!address) {
      setError('Enter your email address');
      return;
    }
    setError('');
    setLoading(true);
    try {
      await forgotPassword(address);
      setSentTo(address.toLowerCase());
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className={`page ${styles.page}`}>
      <section className={styles.card}>
        <h1 className={styles.title}>Forgot password</h1>
        {sentTo ? (
          <div className={styles.form}>
            <p className={styles.notice} role="status">
              If an account exists for <strong>{sentTo}</strong>, we sent it a 6-digit code. It expires in 15 minutes.
            </p>
            <Button
              as={Link}
              to={`/reset-password?email=${encodeURIComponent(sentTo)}`}
              size="lg"
              className={styles.submit}
            >
              Enter the code
            </Button>
            <p className={styles.footer}>
              Wrong address?{' '}
              <button type="button" className={styles.linkButton} onClick={() => setSentTo('')}>
                Try another email
              </button>
            </p>
          </div>
        ) : (
          <>
            <p className={styles.subtitle}>Enter the email on your account and we'll send you a code to reset it.</p>
            <form className={styles.form} onSubmit={handleSubmit} noValidate>
              <Field label="Email" error={error || undefined}>
                <input
                  name="email"
                  type="email"
                  autoComplete="email"
                  autoCapitalize="none"
                  spellCheck={false}
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  autoFocus
                />
              </Field>
              <Button type="submit" size="lg" loading={loading} className={styles.submit}>
                Send code
              </Button>
            </form>
            <p className={styles.footer}>
              Remembered it?{' '}
              <Link to="/signin" className={styles.link}>
                Sign in
              </Link>
            </p>
          </>
        )}
      </section>
    </div>
  );
}
