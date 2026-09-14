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
      updateProfile: (changes) => withUser(api.patch('/users/me', changes)),
      changePassword: (currentPassword, newPassword) =>
        withUser(api.post('/users/me/password', { currentPassword, newPassword })),
      requestEmailChange: (email, password) => api.post('/users/me/email', { email, password }),
      confirmEmailChange: (code) => withUser(api.post('/users/me/email/verify', { code })),
      // Doesn't clear `user`: the caller navigates away in the same transition, so guarded pages don't redirect to sign-in.
      deleteAccount: (confirmation) => api.delete('/users/me', confirmation),
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
