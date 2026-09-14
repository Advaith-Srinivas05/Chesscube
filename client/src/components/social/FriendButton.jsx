import { useState } from 'react';
import { useAuth } from '../../context/AuthContext.jsx';
import { api } from '../../lib/api.js';
import { friendsApi } from '../../lib/friends.js';
import Button from '../ui/Button.jsx';
import Menu from '../ui/Menu.jsx';
import { useToast } from '../ui/Toast.jsx';
import { RemoveFriendDialog } from './FriendList.jsx';
import buttonStyles from '../ui/Button.module.css';
import styles from './Social.module.css';

function CheckIcon() {
  return (
    <svg viewBox="0 0 24 24" className={styles.check} aria-hidden="true">
      <path d="M5 12.5l4.5 4.5L19 7.5" />
    </svg>
  );
}

// Friend actions on another player's profile, driven by the `relation` the profile API returns.
// Mount it with key={username} so a different profile starts from its own relation.
export default function FriendButton({ profile, className = '' }) {
  const { refresh } = useAuth();
  const toast = useToast();
  const { username } = profile;
  const [state, setState] = useState({ relation: profile.relation ?? 'none', requestId: profile.requestId });
  const [busy, setBusy] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  async function run(optimistic, request, onSuccess) {
    const previous = state;
    setBusy(true);
    setState(optimistic);
    try {
      onSuccess(await request());
    } catch (err) {
      toast.show(err.message, { tone: 'danger' });
      setState(previous);
      // 404/409: the pair changed elsewhere (they cancelled, accepted, ...); show the real state.
      if (err.status === 404 || err.status === 409) {
        api
          .get(`/users/${encodeURIComponent(username)}`)
          .then((data) => setState({ relation: data.user.relation ?? 'none', requestId: data.user.requestId }))
          .catch(() => {});
      }
    } finally {
      setBusy(false);
    }
  }

  const becameFriends = () => {
    toast.show(`You're now friends with ${username}`, { tone: 'success' });
    refresh();
  };

  const add = () =>
    run({ relation: 'outgoing' }, () => friendsApi.sendRequest(username), (data) => {
      if (data.status === 'accepted') {
        setState({ relation: 'friends' });
        becameFriends();
      } else {
        setState({ relation: 'outgoing', requestId: data.request.id });
        toast.show('Friend request sent', { tone: 'success' });
      }
    });

  const cancel = () =>
    run({ relation: 'none' }, () => friendsApi.removeRequest(state.requestId), () => toast.show('Request cancelled'));

  const accept = () => run({ relation: 'friends' }, () => friendsApi.accept(state.requestId), becameFriends);

  const decline = () =>
    run({ relation: 'none' }, () => friendsApi.removeRequest(state.requestId), () => {
      toast.show('Request declined');
      refresh();
    });

  const unfriend = () =>
    run({ relation: 'none' }, () => friendsApi.unfriend(username), () =>
      toast.show(`Removed ${username} from your friends`)
    );

  let content;
  switch (state.relation) {
    case 'outgoing':
      content = (
        <Button
          size="sm"
          variant="secondary"
          onClick={cancel}
          disabled={busy || !state.requestId}
          title="Click to cancel the request"
          aria-label="Request sent. Cancel request"
        >
          Request sent
        </Button>
      );
      break;
    case 'incoming':
      content = (
        <>
          <Button size="sm" onClick={accept} disabled={busy}>
            Accept
          </Button>
          <Button size="sm" variant="secondary" onClick={decline} disabled={busy}>
            Decline
          </Button>
        </>
      );
      break;
    case 'friends':
      content = (
        <Menu
          label={`Friends with ${username}. Options`}
          triggerClassName={`${buttonStyles.button} ${buttonStyles.secondary} ${buttonStyles.sm}`}
          items={[{ label: 'Remove friend', danger: true, onSelect: () => setConfirmOpen(true) }]}
        >
          <CheckIcon />
          Friends
        </Menu>
      );
      break;
    default:
      content = (
        <Button size="sm" onClick={add} disabled={busy}>
          Add friend
        </Button>
      );
  }

  return (
    <div className={`${styles.friendButton} ${className}`}>
      {content}
      <RemoveFriendDialog username={username} open={confirmOpen} onClose={() => setConfirmOpen(false)} onConfirm={unfriend} />
    </div>
  );
}
