import { useId, useState } from 'react';
import { useAuth } from '../../context/AuthContext.jsx';
import { useUsernameAvailability } from '../../hooks/useUsernameAvailability.js';
import { PASSWORD_MAX, passwordIssues } from '../../shared/validation.js';
import Avatar from '../Avatar.jsx';
import PasswordChecklist from '../PasswordChecklist.jsx';
import PasswordField from '../PasswordField.jsx';
import UsernameStatus from '../UsernameStatus.jsx';
import FriendButton from '../social/FriendButton.jsx';
import Button from '../ui/Button.jsx';
import Field from '../ui/Field.jsx';
import { useToast } from '../ui/Toast.jsx';
import { CodeStep, DeleteAccountDialog } from './AccountForms.jsx';
import AvatarPicker from './AvatarPicker.jsx';
import card from './Card.module.css';
import styles from './DetailsCard.module.css';
import FriendsPreview from './FriendsPreview.jsx';
import PresenceStatus from './PresenceStatus.jsx';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const memberSince = (date) => new Date(date).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });

// `onSaved(user)` runs after a profile edit (the profile page uses it to follow a rename).
export default function DetailsCard({ user, isOwn = false, onSaved }) {
  const [editing, setEditing] = useState(false);
  const { user: viewer } = useAuth();

  return (
    <section className={`${card.card} ${styles.details}`} aria-label="Player details">
      {editing ? (
        <EditForm user={user} onDone={() => setEditing(false)} onSaved={onSaved} />
      ) : (
        <>
          <div className={styles.identity}>
            <Avatar id={user.avatar} size={96} alt={`${user.username}'s avatar`} />
            <div className={styles.names}>
              <h2 className={styles.username}>{user.username}</h2>
              <p className={styles.since}>Member since {memberSince(user.createdAt)}</p>
              <PresenceStatus user={user} />
            </div>
            {isOwn ? (
              <Button variant="secondary" size="sm" className={styles.editButton} onClick={() => setEditing(true)}>
                Edit profile
              </Button>
            ) : (
              viewer && <FriendButton key={user.username} profile={user} className={styles.editButton} />
            )}
          </div>

          {isOwn && (
            <dl className={styles.rows}>
              <div className={styles.row}>
                <dt>Email</dt>
                <dd>{user.email}</dd>
              </div>
              <div className={styles.row}>
                <dt>Password</dt>
                <dd className={user.hasPassword ? '' : styles.muted}>{user.hasPassword ? '••••••••' : 'Not set'}</dd>
              </div>
            </dl>
          )}

          <FriendsPreview username={user.username} isOwn={isOwn} />
        </>
      )}
    </section>
  );
}

// Everything editable in one form. Username, avatar and a password change apply on Save; a new email
// (and a first password for Google accounts) then needs an emailed code, confirmed in follow-up steps.
function EditForm({ user, onDone, onSaved }) {
  const { updateProfile, changePassword, requestEmailChange, confirmEmailChange, forgotPassword, resetPassword } =
    useAuth();
  const toast = useToast();
  const pickerId = useId();
  const rulesId = useId();

  const [avatar, setAvatar] = useState(user.avatar);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [username, setUsername] = useState(user.username);
  const [email, setEmail] = useState(user.email);
  const [newPassword, setNewPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [confirmTouched, setConfirmTouched] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [steps, setSteps] = useState([]);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const name = username.trim();
  const address = email.trim().toLowerCase();
  const nameChanged = name !== user.username;
  const avatarChanged = avatar !== user.avatar;
  const emailChanged = address !== user.email;
  const passwordChanged = newPassword !== '';
  const needsCurrent = user.hasPassword && (emailChanged || passwordChanged);

  // The current name needs no check; a casing change still goes to the server, which treats it as yours.
  const availability = useUsernameAvailability(nameChanged ? username : '');
  const nameOk = !nameChanged || availability.state === 'available';
  const emailOk = !emailChanged || EMAIL_RE.test(address);
  const passwordOk =
    !passwordChanged ||
    (passwordIssues(newPassword).length === 0 && newPassword.length <= PASSWORD_MAX && confirm === newPassword);
  const hasChanges = nameChanged || avatarChanged || emailChanged || passwordChanged;
  const canSave = hasChanges && nameOk && emailOk && passwordOk && (!needsCurrent || currentPassword !== '');

  const clearError = (field) => setErrors((current) => ({ ...current, [field]: undefined, form: undefined }));

  async function handleSubmit(event) {
    event.preventDefault();
    if (!canSave) return;
    setErrors({});
    setSaving(true);
    const done = [];
    try {
      if (nameChanged || avatarChanged) {
        const data = await updateProfile({ ...(nameChanged && { username: name }), ...(avatarChanged && { avatar }) });
        onSaved?.(data.user);
        done.push('profile');
      }

      // Whatever proves the account's password from here on.
      let proof = currentPassword;
      if (passwordChanged && user.hasPassword) {
        await changePassword(currentPassword, newPassword);
        proof = newPassword;
        setCurrentPassword(newPassword); // a retry of the email change uses the new password
        setNewPassword('');
        setConfirm('');
        done.push('password');
      }

      const pending = [];
      if (emailChanged) {
        const password = user.hasPassword ? proof : undefined;
        await requestEmailChange(address, password);
        pending.push({ type: 'email', to: address, password });
      }
      if (passwordChanged && !user.hasPassword) pending.push({ type: 'setPassword', password: newPassword });

      if (done.length) {
        const message = done.includes('password') ? 'Saved. Other devices have been signed out.' : 'Profile saved';
        toast.show(message, { tone: 'success' });
      }
      setSaving(false);
      if (pending.length) setSteps(pending);
      else onDone();
    } catch (err) {
      setSaving(false);
      if (done.length) toast.show('Some changes were saved', { tone: 'info' });
      // The email-change endpoint calls the proof field `password`; here that's the current password.
      const field = err.field === 'password' ? 'currentPassword' : err.field;
      const known = ['username', 'email', 'currentPassword', 'newPassword'].includes(field);
      setErrors(known ? { [field]: err.message } : { form: err.message });
    }
  }

  function nextStep(message) {
    if (message) toast.show(message, { tone: 'success' });
    const rest = steps.slice(1);
    setSteps(rest);
    if (rest.length === 0) onDone();
  }

  const [current] = steps;
  if (current?.type === 'email') {
    return (
      <CodeStep
        key="email"
        title="Confirm your new email"
        text={
          <>
            We sent a 6-digit code to <strong>{current.to}</strong>. Your email changes once you enter it.
          </>
        }
        send={() => requestEmailChange(current.to, current.password)}
        confirm={async (code) => {
          await confirmEmailChange(code);
          nextStep('Email updated');
        }}
        confirmLabel="Confirm email"
        onSkip={() => nextStep()}
      />
    );
  }
  if (current?.type === 'setPassword') {
    return (
      <CodeStep
        key="password"
        title="Confirm it's you"
        text={
          <>
            To set a password, enter the code we sent to <strong>{user.email}</strong>.
          </>
        }
        send={() => forgotPassword(user.email)}
        sendOnMount
        confirm={async (code) => {
          await resetPassword({ email: user.email, code, password: current.password });
          nextStep('Password set. You can now sign in with it too.');
        }}
        confirmLabel="Set password"
        onSkip={() => nextStep()}
      />
    );
  }

  return (
    <>
      <form className={styles.form} onSubmit={handleSubmit} noValidate>
        <h2 className="sr-only">Edit profile</h2>
        {errors.form && (
          <p className={styles.alert} role="alert">
            {errors.form}
          </p>
        )}

        <div className={styles.editIdentity}>
          <button
            type="button"
            className={`${styles.avatarButton} ${pickerOpen ? styles.avatarButtonOpen : ''}`}
            aria-expanded={pickerOpen}
            aria-controls={pickerId}
            aria-label="Change profile picture"
            onClick={() => setPickerOpen((open) => !open)}
          >
            <Avatar id={avatar} size={96} />
            <span className={styles.avatarBadge} aria-hidden="true">
              <svg viewBox="0 0 24 24">
                <path d="M4 20h4L19 9l-4-4L4 16zM13.5 6.5l4 4" />
              </svg>
            </span>
          </button>
          <Field
            className={styles.usernameField}
            label="Username"
            error={errors.username}
            hint={
              errors.username ? undefined : nameChanged ? <UsernameStatus availability={availability} /> : undefined
            }
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
                clearError('username');
              }}
            />
          </Field>
        </div>

        {pickerOpen && (
          <div id={pickerId} className={styles.picker}>
            <AvatarPicker
              value={avatar}
              onChange={(id) => {
                setAvatar(id);
                setPickerOpen(false);
              }}
            />
          </div>
        )}

        <Field
          label="Email"
          error={errors.email ?? (emailChanged && address && !emailOk ? 'Enter a valid email address' : undefined)}
          hint={emailChanged && emailOk ? "We'll send a code to the new address to confirm it." : undefined}
        >
          <input
            name="email"
            type="email"
            autoComplete="email"
            autoCapitalize="none"
            spellCheck={false}
            maxLength={254}
            value={email}
            onChange={(event) => {
              setEmail(event.target.value);
              clearError('email');
            }}
          />
        </Field>

        <PasswordField
          label={user.hasPassword ? 'New password' : 'Set a password'}
          name="new-password"
          autoComplete="new-password"
          maxLength={PASSWORD_MAX}
          value={newPassword}
          onChange={(event) => {
            setNewPassword(event.target.value);
            clearError('newPassword');
          }}
          error={errors.newPassword}
          hint={
            passwordChanged
              ? undefined
              : user.hasPassword
                ? 'Leave blank to keep your current password.'
                : 'Optional. Lets you sign in with your email as well as Google.'
          }
          aria-describedby={passwordChanged ? rulesId : undefined}
        />
        {passwordChanged && (
          <>
            <PasswordChecklist id={rulesId} password={newPassword} />
            <PasswordField
              label="Confirm new password"
              name="confirm-password"
              autoComplete="new-password"
              maxLength={PASSWORD_MAX}
              value={confirm}
              onChange={(event) => setConfirm(event.target.value)}
              onBlur={() => setConfirmTouched(true)}
              error={confirmTouched && confirm && confirm !== newPassword ? "Passwords don't match" : undefined}
            />
          </>
        )}

        {needsCurrent && (
          <PasswordField
            label="Current password"
            name="current-password"
            autoComplete="current-password"
            maxLength={PASSWORD_MAX}
            value={currentPassword}
            onChange={(event) => {
              setCurrentPassword(event.target.value);
              clearError('currentPassword');
            }}
            error={errors.currentPassword}
            hint={errors.currentPassword ? undefined : 'Needed to change your email or password.'}
          />
        )}

        <div className={styles.actions}>
          <Button type="submit" loading={saving} disabled={!canSave}>
            Save
          </Button>
          <Button variant="ghost" onClick={onDone} disabled={saving}>
            Cancel
          </Button>
          <Button variant="ghost" className={styles.delete} onClick={() => setDeleteOpen(true)} disabled={saving}>
            Delete account
          </Button>
        </div>
      </form>
      {/* Outside the form: the dialog has a form of its own. */}
      <DeleteAccountDialog user={user} open={deleteOpen} onClose={() => setDeleteOpen(false)} />
    </>
  );
}
