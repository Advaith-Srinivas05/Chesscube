import { startTransition, useEffect, useId, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';
import { useCountdown } from '../../hooks/useCountdown.js';
import { PASSWORD_MAX } from '../../shared/validation.js';
import CodeInput from '../CodeInput.jsx';
import PasswordField from '../PasswordField.jsx';
import Button from '../ui/Button.jsx';
import Dialog from '../ui/Dialog.jsx';
import Field from '../ui/Field.jsx';
import { useToast } from '../ui/Toast.jsx';
import styles from './AccountForms.module.css';

const RESEND_SECONDS = 60;

// One emailed-code confirmation inside the edit form.
// `send()` (re)sends the code; with `sendOnMount` the first code goes out when the step appears.
// `confirm(code)` resolves when the change is done; `onSkip` leaves this change unapplied.
export function CodeStep({ title, text, send, sendOnMount = false, confirm, confirmLabel, onSkip }) {
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [resendIn, restartResend] = useCountdown(sendOnMount ? 0 : RESEND_SECONDS);
  const sentRef = useRef(false);

  async function resend() {
    setError('');
    try {
      const data = await send();
      setCode('');
      restartResend(data?.resendIn ?? RESEND_SECONDS);
    } catch (err) {
      if (err.data?.retryAfter) restartResend(err.data.retryAfter);
      setError(err.message);
    }
  }

  useEffect(() => {
    if (!sendOnMount || sentRef.current) return;
    sentRef.current = true;
    resend();
  }, []); // once, when the step appears

  async function submit(value = code) {
    if (value.length !== 6 || busy) return;
    setError('');
    setBusy(true);
    try {
      await confirm(value);
    } catch (err) {
      setBusy(false);
      setCode('');
      setError(err.message);
    }
  }

  return (
    <form
      className={styles.form}
      onSubmit={(event) => {
        event.preventDefault();
        submit();
      }}
      noValidate
    >
      <h3 className={styles.title}>{title}</h3>
      <p className={styles.text}>{text} Check spam if it isn't in your inbox.</p>
      {error && (
        <p className={styles.alert} role="alert">
          {error}
        </p>
      )}
      <CodeInput
        value={code}
        onChange={setCode}
        onComplete={submit}
        disabled={busy}
        invalid={Boolean(error)}
        label="Code"
        autoFocus
      />
      <div className={styles.actions}>
        <Button type="submit" loading={busy} disabled={code.length !== 6}>
          {confirmLabel}
        </Button>
        <Button variant="ghost" onClick={resend} disabled={busy || resendIn > 0}>
          {resendIn > 0 ? `Resend in ${resendIn}s` : 'Resend code'}
        </Button>
        <Button variant="ghost" onClick={onSkip} disabled={busy}>
          Skip
        </Button>
      </div>
    </form>
  );
}

export function DeleteAccountDialog({ user, open, onClose }) {
  const { deleteAccount, setUser } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const formId = useId();
  const [value, setValue] = useState('');
  const [error, setError] = useState('');
  const [deleting, setDeleting] = useState(false);

  const usesPassword = user.hasPassword;
  const canDelete = usesPassword ? value !== '' : value.trim() === user.username;

  function close() {
    if (deleting) return;
    setValue('');
    setError('');
    onClose();
  }

  async function handleSubmit(event) {
    event.preventDefault();
    if (!canDelete) return;
    setError('');
    setDeleting(true);
    try {
      await deleteAccount(usesPassword ? { password: value } : { confirmUsername: value.trim() });
      // React Router navigates inside a transition; clearing the user in the same transition commits both
      // together, so RequireAuth on /profile never sees a signed-out user and redirects to sign-in.
      startTransition(() => {
        navigate('/', { replace: true });
        setUser(null);
      });
      toast.show('Your account has been deleted');
    } catch (err) {
      setDeleting(false);
      setError(err.message);
    }
  }

  const onChange = (event) => {
    setValue(event.target.value);
    setError('');
  };

  return (
    <Dialog
      open={open}
      onClose={close}
      title="Delete your account?"
      footer={
        <>
          <Button variant="ghost" onClick={close} disabled={deleting}>
            Cancel
          </Button>
          <Button type="submit" form={formId} variant="danger" loading={deleting} disabled={!canDelete}>
            Delete account
          </Button>
        </>
      }
    >
      <form id={formId} className={styles.form} onSubmit={handleSubmit} noValidate>
        <p className={styles.text}>This permanently removes:</p>
        <ul className={styles.list}>
          <li>your profile, avatar and sign-in details</li>
          <li>your ratings, puzzle streak and lesson progress</li>
        </ul>
        <p className={styles.text}>
          Your username <strong>{user.username}</strong> and email become free for anyone to use.
        </p>
        {usesPassword ? (
          <PasswordField
            label="Enter your password to confirm"
            name="password"
            autoComplete="current-password"
            maxLength={PASSWORD_MAX}
            value={value}
            onChange={onChange}
            error={error || undefined}
            autoFocus
          />
        ) : (
          <Field label={`Type ${user.username} to confirm`} error={error || undefined}>
            <input
              name="confirm-username"
              autoComplete="off"
              autoCapitalize="none"
              spellCheck={false}
              value={value}
              onChange={onChange}
              autoFocus
            />
          </Field>
        )}
      </form>
    </Dialog>
  );
}
