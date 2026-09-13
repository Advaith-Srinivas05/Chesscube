import { useEffect, useState } from 'react';
import { api } from '../lib/api.js';
import { usernameIssue } from '../shared/validation.js';

const DEBOUNCE_MS = 400;
const IDLE = { state: 'idle', message: '' };

// state: 'idle' | 'checking' | 'available' | 'taken' | 'invalid'
export function useUsernameAvailability(username, email) {
  const [result, setResult] = useState(IDLE);

  useEffect(() => {
    const name = username.trim();
    if (!name) {
      setResult(IDLE);
      return undefined;
    }

    const controller = new AbortController();
    // Local rules first (still debounced, so "Username must be at least 3 characters" doesn't flash while typing).
    const issue = usernameIssue(name);
    setResult(issue ? IDLE : { state: 'checking', message: 'Checking…' });

    const timer = setTimeout(async () => {
      if (issue) {
        setResult({ state: 'invalid', message: issue });
        return;
      }
      try {
        const params = new URLSearchParams({ username: name });
        if (email?.trim()) params.set('email', email.trim());
        const data = await api.get(`/auth/username-available?${params}`, { signal: controller.signal });
        setResult(
          data.available
            ? { state: 'available', message: 'Username is available' }
            : { state: 'taken', message: data.message ?? 'That username is taken' }
        );
      } catch (err) {
        if (err.name !== 'AbortError') setResult({ state: 'idle', message: "Couldn't check the username" });
      }
    }, DEBOUNCE_MS);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [username, email]);

  return result;
}
