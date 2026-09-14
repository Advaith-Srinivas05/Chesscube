import { useCallback, useEffect, useRef, useState } from 'react';
import { useToast } from '../components/ui/Toast.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { friendsApi } from '../lib/friends.js';

const byUsername = (a, b) => a.user.username.localeCompare(b.user.username, 'en', { sensitivity: 'base' });
const without = (list, username) => list.filter((entry) => entry.user.username !== username);
const sameName = (a, b) => a.toLowerCase() === b.toLowerCase();

// Friends and requests for the Socials page. Every action updates the lists at once, then rolls back
// (or reloads, when the server says the lists are out of date) and shows a toast if the request fails.
export function useFriends() {
  const { user, refresh } = useAuth();
  const toast = useToast();
  const [lists, setLists] = useState(null); // { friends, incoming, outgoing }
  const [error, setError] = useState(null);
  const [attempt, setAttempt] = useState(0);
  const [busy, setBusy] = useState(() => new Set()); // usernames with an action in flight
  const badgeRef = useRef(user?.incomingRequests);
  badgeRef.current = user?.incomingRequests;

  const load = useCallback(
    (signal) =>
      friendsApi.list({ signal }).then((data) => {
        setLists(data);
        setError(null);
        // Keep the navbar badge in step with what this page shows.
        if (data.incoming.length !== badgeRef.current) refresh();
      }),
    [refresh]
  );

  useEffect(() => {
    const controller = new AbortController();
    load(controller.signal).catch((err) => {
      if (err.name !== 'AbortError') setError(err.message);
    });
    return () => controller.abort();
  }, [load, attempt]);

  const update = (change) => setLists((current) => current && change(current));

  function setBusyName(username, value) {
    setBusy((current) => {
      const next = new Set(current);
      if (value) next.add(username);
      else next.delete(username);
      return next;
    });
  }

  async function run(username, { apply, rollback, request, onSuccess }) {
    setBusyName(username, true);
    update(apply);
    try {
      onSuccess(await request());
    } catch (err) {
      // 404/409: someone else changed this pair (they cancelled, accepted, ...). Show the real state.
      if (err.status === 404 || err.status === 409) load().catch(() => update(rollback));
      else update(rollback);
      toast.show(err.message, { tone: 'danger' });
    } finally {
      setBusyName(username, false);
    }
  }

  function relationOf(username) {
    if (!lists) return null;
    const find = (list) => list.find((entry) => sameName(entry.user.username, username));
    if (find(lists.friends)) return { relation: 'friends' };
    const incoming = find(lists.incoming);
    if (incoming) return { relation: 'incoming', request: incoming };
    const outgoing = find(lists.outgoing);
    if (outgoing) return { relation: 'outgoing', request: outgoing };
    return { relation: 'none' };
  }

  function becameFriends(other) {
    return (current) => ({
      friends: [...without(current.friends, other.username), { user: other, since: new Date().toISOString() }].sort(
        byUsername
      ),
      incoming: without(current.incoming, other.username),
      outgoing: without(current.outgoing, other.username),
    });
  }

  function accept(request) {
    const other = request.user;
    return run(other.username, {
      apply: becameFriends(other),
      rollback: (current) => ({
        ...current,
        friends: without(current.friends, other.username),
        incoming: [request, ...without(current.incoming, other.username)],
      }),
      request: () => friendsApi.accept(request.id),
      onSuccess: (data) => {
        update((current) => ({ ...current, friends: [...without(current.friends, other.username), data.friend].sort(byUsername) }));
        toast.show(`You're now friends with ${other.username}`, { tone: 'success' });
        refresh();
      },
    });
  }

  function sendRequest(other) {
    const existing = relationOf(other.username);
    if (existing?.relation === 'incoming') return accept(existing.request);

    const placeholder = { id: null, user: other, createdAt: new Date().toISOString() };
    return run(other.username, {
      apply: (current) => ({ ...current, outgoing: [placeholder, ...without(current.outgoing, other.username)] }),
      rollback: (current) => ({ ...current, outgoing: without(current.outgoing, other.username) }),
      request: () => friendsApi.sendRequest(other.username),
      onSuccess: (data) => {
        if (data.status === 'accepted') {
          update(becameFriends(data.friend.user));
          toast.show(`You're now friends with ${other.username}`, { tone: 'success' });
          refresh();
        } else {
          update((current) => ({ ...current, outgoing: [data.request, ...without(current.outgoing, other.username)] }));
          toast.show('Friend request sent', { tone: 'success' });
        }
      },
    });
  }

  function removeRequest(request, direction) {
    const key = direction === 'incoming' ? 'incoming' : 'outgoing';
    const other = request.user;
    return run(other.username, {
      apply: (current) => ({ ...current, [key]: without(current[key], other.username) }),
      rollback: (current) => ({ ...current, [key]: [request, ...without(current[key], other.username)] }),
      request: () => friendsApi.removeRequest(request.id),
      onSuccess: () => {
        toast.show(key === 'incoming' ? 'Request declined' : 'Request cancelled');
        if (key === 'incoming') refresh();
      },
    });
  }

  function unfriend(friend) {
    const other = friend.user;
    return run(other.username, {
      apply: (current) => ({ ...current, friends: without(current.friends, other.username) }),
      rollback: (current) => ({ ...current, friends: [...without(current.friends, other.username), friend].sort(byUsername) }),
      request: () => friendsApi.unfriend(other.username),
      onSuccess: () => toast.show(`Removed ${other.username} from your friends`),
    });
  }

  return {
    lists,
    error,
    retry: () => setAttempt((n) => n + 1),
    isBusy: (username) => busy.has(username),
    relationOf,
    sendRequest,
    accept,
    decline: (request) => removeRequest(request, 'incoming'),
    cancel: (request) => removeRequest(request, 'outgoing'),
    unfriend,
  };
}
