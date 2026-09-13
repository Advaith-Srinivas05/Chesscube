import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api } from '../lib/api.js';

const AuthContext = createContext(null);

// Accounts are optional: `user` is null for guests. status is 'loading' until /auth/me has answered.
export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [status, setStatus] = useState('loading');

  const refresh = useCallback(async () => {
    try {
      const data = await api.get('/auth/me');
      setUser(data.user);
    } catch {
      setUser(null);
    } finally {
      setStatus('ready');
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

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
      forgotPassword: (email) => api.post('/auth/forgot-password', { email }),
      resetPassword: ({ email, code, password }) =>
        withUser(api.post('/auth/reset-password', { email, code, password })),
      signOut: async () => {
        try {
          await api.post('/auth/logout');
        } finally {
          setUser(null);
        }
      },
    };
  }, []);

  const value = useMemo(() => ({ user, status, refresh, setUser, ...actions }), [user, status, refresh, actions]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside AuthProvider');
  return context;
}
