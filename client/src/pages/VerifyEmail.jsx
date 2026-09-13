import { useState } from 'react';
import { Link, Navigate, useSearchParams } from 'react-router-dom';
import CodeInput from '../components/CodeInput.jsx';
import Button from '../components/ui/Button.jsx';
import { useToast } from '../components/ui/Toast.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { useCountdown } from '../hooks/useCountdown.js';
import { useNextPath, withNext } from '../hooks/useNextPath.js';
import styles from './Auth.module.css';

const RESEND_SECONDS = 60;

export default function VerifyEmail() {
  const { verifySignup, resendSignupCode } = useAuth();
  const toast = useToast();
  const next = useNextPath();
  const [params] = useSearchParams();
  const email = params.get('email')?.trim() ?? '';
  const [code, setCode] = useState('');
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [resendIn, restartResend] = useCountdown(RESEND_SECONDS);

  if (!email) return <Navigate to={withNext('/signup', next)} replace />;

  async function submit(value = code) {
    if (value.length !== 6 || loading) return;
    setError(null);
    setLoading(true);
    try {
      const { user } = await verifySignup(email, value);
      toast.show(`Welcome to Chesscube, ${user.username}!`, { tone: 'success' });
      // GuestOnly moves on to ?next= now that the user is set.
    } catch (err) {
      setLoading(false);
      setCode('');
      setError({ message: err.message, expired: err.code === 'SIGNUP_EXPIRED' });
    }
  }

  async function resend() {
    setError(null);
    setResending(true);
    try {
      await resendSignupCode(email);
      setCode('');
      restartResend(RESEND_SECONDS);
      toast.show('We sent you a new code', { tone: 'success' });
    } catch (err) {
      if (err.data?.retryAfter) restartResend(err.data.retryAfter);
      setError({ message: err.message, expired: err.code === 'SIGNUP_EXPIRED' });
    } finally {
      setResending(false);
    }
  }

  return (
    <div className={`page ${styles.page}`}>
      <section className={styles.card}>
        <h1 className={styles.title}>Check your email</h1>
        <p className={styles.subtitle}>
          We sent a 6-digit code to <strong>{email}</strong>. It expires in 15 minutes.
        </p>

        <form
          className={styles.form}
          onSubmit={(event) => {
            event.preventDefault();
            submit();
          }}
        >
          {error && (
            <p className={styles.alert} role="alert">
              {error.message}
              {error.expired && (
                <>
                  {' '}
                  <Link to={withNext('/signup', next)}>Sign up again</Link>
                </>
              )}
            </p>
          )}
          <CodeInput value={code} onChange={setCode} onComplete={submit} disabled={loading} invalid={Boolean(error)} autoFocus />
          <Button type="submit" size="lg" loading={loading} disabled={code.length !== 6} className={styles.submit}>
            Verify email
          </Button>
          <div className={styles.row}>
            <span>
              Didn't get it?{' '}
              <button type="button" className={styles.linkButton} onClick={resend} disabled={resendIn > 0 || resending}>
                {resendIn > 0 ? `Resend in ${resendIn}s` : 'Resend code'}
              </button>
            </span>
            <Link to={withNext('/signup', next)} className={styles.link}>
              Use a different email
            </Link>
          </div>
        </form>
        <p className={styles.footer}>Check your spam folder if it isn't in your inbox.</p>
      </section>
    </div>
  );
}
