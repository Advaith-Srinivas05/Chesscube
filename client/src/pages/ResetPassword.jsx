import { useState } from 'react';
import { Link, Navigate, useSearchParams } from 'react-router-dom';
import CodeInput from '../components/CodeInput.jsx';
import PasswordChecklist from '../components/PasswordChecklist.jsx';
import PasswordField from '../components/PasswordField.jsx';
import Button from '../components/ui/Button.jsx';
import { useToast } from '../components/ui/Toast.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { PASSWORD_MAX, passwordIssues } from '../shared/validation.js';
import styles from './Auth.module.css';

export default function ResetPassword() {
  const { resetPassword } = useAuth();
  const toast = useToast();
  const [params] = useSearchParams();
  const email = params.get('email')?.trim() ?? '';
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [confirmTouched, setConfirmTouched] = useState(false);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  if (!email) return <Navigate to="/forgot-password" replace />;

  const passwordValid = passwordIssues(password).length === 0 && password.length <= PASSWORD_MAX;
  const canSubmit = code.length === 6 && passwordValid && confirm === password;

  async function handleSubmit(event) {
    event.preventDefault();
    if (!canSubmit) return;
    setError(null);
    setLoading(true);
    try {
      await resetPassword({ email, code, password });
      toast.show('Password updated. Other devices have been signed out.', { tone: 'success' });
      // GuestOnly sends the now signed-in user home.
    } catch (err) {
      setLoading(false);
      if (err.field === 'password') {
        setError({ message: err.message });
      } else {
        setCode('');
        setError({ message: err.message, codeProblem: true });
      }
    }
  }

  return (
    <div className={`page ${styles.page}`}>
      <section className={styles.card}>
        <h1 className={styles.title}>Reset password</h1>
        <p className={styles.subtitle}>
          Enter the code we sent to <strong>{email}</strong> and choose a new password.
        </p>

        <form className={styles.form} onSubmit={handleSubmit} noValidate>
          {error && (
            <p className={styles.alert} role="alert">
              {error.message}
            </p>
          )}
          <CodeInput value={code} onChange={setCode} invalid={Boolean(error?.codeProblem)} label="Reset code" autoFocus />
          <PasswordField
            label="New password"
            name="password"
            autoComplete="new-password"
            maxLength={PASSWORD_MAX}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            aria-describedby="reset-password-rules"
          />
          <PasswordChecklist id="reset-password-rules" password={password} />
          <PasswordField
            label="Confirm new password"
            name="confirm"
            autoComplete="new-password"
            maxLength={PASSWORD_MAX}
            value={confirm}
            onChange={(event) => setConfirm(event.target.value)}
            onBlur={() => setConfirmTouched(true)}
            error={confirmTouched && confirm && confirm !== password ? "Passwords don't match" : undefined}
          />
          <Button type="submit" size="lg" loading={loading} disabled={!canSubmit} className={styles.submit}>
            Update password
          </Button>
        </form>

        <p className={styles.footer}>
          No code?{' '}
          <Link to="/forgot-password" className={styles.link}>
            Send another
          </Link>
        </p>
      </section>
    </div>
  );
}
