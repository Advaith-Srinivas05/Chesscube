import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import GoogleButton, { GOOGLE_ENABLED } from '../components/GoogleButton.jsx';
import PasswordChecklist from '../components/PasswordChecklist.jsx';
import PasswordField from '../components/PasswordField.jsx';
import UsernameStatus from '../components/UsernameStatus.jsx';
import Button from '../components/ui/Button.jsx';
import Field from '../components/ui/Field.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { useNextPath, withNext } from '../hooks/useNextPath.js';
import { useUsernameAvailability } from '../hooks/useUsernameAvailability.js';
import { PASSWORD_MAX, passwordIssues } from '../shared/validation.js';
import styles from './Auth.module.css';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function SignUp() {
  const { signUp } = useAuth();
  const navigate = useNavigate();
  const next = useNextPath();
  const [form, setForm] = useState({ username: '', email: '', password: '', confirm: '' });
  const [touched, setTouched] = useState({});
  const [serverErrors, setServerErrors] = useState({});
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const email = form.email.trim();
  const availability = useUsernameAvailability(form.username, EMAIL_RE.test(email) ? email : '');
  const emailValid = EMAIL_RE.test(email);
  const passwordValid = passwordIssues(form.password).length === 0 && form.password.length <= PASSWORD_MAX;
  const confirmValid = form.confirm === form.password;
  const canSubmit = availability.state === 'available' && emailValid && passwordValid && confirmValid && form.confirm !== '';

  const update = (field) => (event) => {
    setForm((current) => ({ ...current, [field]: event.target.value }));
    setServerErrors((current) => ({ ...current, [field]: undefined }));
  };
  const touch = (field) => () => setTouched((current) => ({ ...current, [field]: true }));

  async function handleSubmit(event) {
    event.preventDefault();
    if (!canSubmit) return;
    setError('');
    setLoading(true);
    try {
      const data = await signUp({ username: form.username.trim(), email, password: form.password });
      navigate(withNext(`/verify-email?email=${encodeURIComponent(data.email)}`, next));
    } catch (err) {
      setLoading(false);
      if (err.field) setServerErrors({ [err.field]: err.message });
      else setError(err.message);
    }
  }

  return (
    <div className={`page ${styles.page}`}>
      <section className={styles.card}>
        <h1 className={styles.title}>Create your account</h1>
        <p className={styles.subtitle}>Free, and optional: you can always keep playing as a guest.</p>

        <form className={styles.form} onSubmit={handleSubmit} noValidate>
          {error && (
            <p className={styles.alert} role="alert">
              {error}
            </p>
          )}
          <Field
            label="Username"
            error={serverErrors.username}
            hint={serverErrors.username ? undefined : <UsernameStatus availability={availability} />}
          >
            <input
              name="username"
              autoComplete="username"
              autoCapitalize="none"
              spellCheck={false}
              maxLength={20}
              value={form.username}
              onChange={update('username')}
              autoFocus
            />
          </Field>
          <Field
            label="Email"
            hint="We'll send a code to confirm it."
            error={serverErrors.email ?? (touched.email && email && !emailValid ? 'Enter a valid email address' : undefined)}
          >
            <input
              name="email"
              type="email"
              autoComplete="email"
              autoCapitalize="none"
              spellCheck={false}
              value={form.email}
              onChange={update('email')}
              onBlur={touch('email')}
            />
          </Field>
          <PasswordField
            name="password"
            autoComplete="new-password"
            maxLength={PASSWORD_MAX}
            value={form.password}
            onChange={update('password')}
            error={serverErrors.password}
            aria-describedby="password-rules"
          />
          <PasswordChecklist id="password-rules" password={form.password} />
          <PasswordField
            label="Confirm password"
            name="confirm"
            autoComplete="new-password"
            maxLength={PASSWORD_MAX}
            value={form.confirm}
            onChange={update('confirm')}
            onBlur={touch('confirm')}
            error={touched.confirm && form.confirm && !confirmValid ? "Passwords don't match" : undefined}
          />
          <Button type="submit" size="lg" loading={loading} disabled={!canSubmit} className={styles.submit}>
            Create account
          </Button>
        </form>

        {GOOGLE_ENABLED && (
          <>
            <div className={styles.divider}>or</div>
            <GoogleButton next={next} onError={setError} />
          </>
        )}

        <p className={styles.footer}>
          Already have an account?{' '}
          <Link to={withNext('/signin', next)} className={styles.link}>
            Sign in
          </Link>
        </p>
      </section>
    </div>
  );
}
