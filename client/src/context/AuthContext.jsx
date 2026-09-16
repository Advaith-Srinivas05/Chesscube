import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { api } from '../lib/api.js';
import { setSocketAuth } from '../lib/socket.js';

const AuthContext = createContext(null);

// Accounts are optional: `user` is null for guests. status is 'loading' until /auth/me has answered.
export function AuthProvider({ children }) {
  const [user, replaceUser] = useState(null);
  const [status, setStatus] = useState('loading');
  const userIdRef = useRef(null);
  userIdRef.current = user?.id ?? null;

  const refresh = useCallback(async () => {
    try {
      const data = await api.get('/auth/me');
      replaceUser(data.user);
    } catch {
      replaceUser(null);
    } finally {
      setStatus('ready');
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // The game server connection follows the signed-in account.
  useEffect(() => {
    setSocketAuth({ ready: status === 'ready', userId: user?.id ?? null });
  }, [status, user?.id]);

  // Only /auth/me reports incomingRequests (the navbar badge), so a user from any other response keeps
  // the current count. A different account (a new sign-in) fetches its own.
  const setUser = useCallback(
    (next) => {
      if (!next || next.incomingRequests !== undefined) {
        replaceUser(next);
      } else if (userIdRef.current === next.id) {
        replaceUser((current) => ({ incomingRequests: current?.incomingRequests, ...next }));
      } else {
        replaceUser(next);
        refresh();
      }
    },
    [refresh]
  );

  const actions = useMemo(() => {
    const withUser = (promise) =>
      promise.then((data) => {
        if (data?.user) setUser(data.user);
        return data;
      });

    return {
      signIn: (login, password) => withUser(api.post('/auth/signin', { login, password })),
      signUp: ({ username, email, password }) => api.post('/auth/signup', { username, email, password }),
      verifySignup: (email, code) => withUser(api.post('/auth/signup/verify', { email, code })),
      resendSignupCode: (email) => api.post('/auth/signup/resend', { email }),
      googleSignIn: (credential) => withUser(api.post('/auth/google', { credential })),
      completeGoogleSignup: (signupToken, username) =>
        withUser(api.post('/auth/google/complete', { signupToken, username })),
      linkGoogle: (linkToken, password) => withUser(api.post('/auth/google/link', { linkToken, password })),
      forgotPassword: (email) => api.post('/auth/forgot-password', { email }),
      resetPassword: ({ email, code, password }) =>
        withUser(api.post('/auth/reset-password', { email, code, password })),
      updateProfile: (changes) => withUser(api.patch('/users/me', changes)),
      changePassword: (currentPassword, newPassword) =>
        withUser(api.post('/users/me/password', { currentPassword, newPassword })),
      requestEmailChange: (email, password) => api.post('/users/me/email', { email, password }),
      confirmEmailChange: (code) => withUser(api.post('/users/me/email/verify', { code })),
      completeLesson: (lessonId) => withUser(api.post(`/users/me/lessons/${encodeURIComponent(lessonId)}`)),
      // Doesn't clear `user`: the caller navigates away in the same transition, so guarded pages don't redirect to sign-in.
      deleteAccount: (confirmation) => api.delete('/users/me', confirmation),
      signOut: async () => {
        try {
          await api.post('/auth/logout');
        } finally {
          setUser(null);
        }
      },
      // Ends every session of the account, on all devices. Like deleteAccount it doesn't clear `user`: the caller
      // navigates away and clears it in one transition.
      signOutEverywhere: () => api.post('/auth/logout-all'),
    };
  }, [setUser]);

  const value = useMemo(
    () => ({ user, status, refresh, setUser, ...actions }),
    [user, status, refresh, setUser, actions]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside AuthProvider');
  return context;
}
