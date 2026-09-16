import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { useSettings } from '../context/SettingsContext.jsx';
import { withNext } from '../hooks/useNextPath.js';
import styles from './GoogleButton.module.css';

const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID;
export const GOOGLE_ENABLED = Boolean(CLIENT_ID);
export const GOOGLE_SIGNUP_KEY = 'googleSignup';
export const GOOGLE_LINK_KEY = 'googleLink';

// Router state is lost on refresh, so the Google pages also keep a copy in sessionStorage.
export function rememberGoogleStep(key, state) {
  try {
    sessionStorage.setItem(key, JSON.stringify(state));
  } catch {
    // Without storage a refresh on the next page just starts over.
  }
}

// An existing account whose email Google can't vouch for: its password is asked once before linking.
export function goToGoogleLink(navigate, data, next) {
  const state = { linkToken: data.linkToken, email: data.email };
  rememberGoogleStep(GOOGLE_LINK_KEY, state);
  navigate(withNext('/signin/link-google', next), { state });
}

let scriptPromise;
function loadGoogleScript() {
  scriptPromise ??= new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.onload = () => resolve(window.google);
    script.onerror = () => {
      scriptPromise = undefined;
      reject(new Error('Google sign-in could not load'));
    };
    document.head.appendChild(script);
  });
  return scriptPromise;
}

// Google Identity Services may be initialised once per page, so its callback forwards to the mounted button.
let handleCredential = null;
let initialised = false;

// Renders Google's own button (required by their branding rules). Signed-in results are picked up by GuestOnly;
// new Google users continue to /signup/username.
export default function GoogleButton({ next = '/', onError }) {
  const { googleSignIn } = useAuth();
  const { resolvedTheme } = useSettings();
  const navigate = useNavigate();
  const containerRef = useRef(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    handleCredential = async ({ credential }) => {
      try {
        const data = await googleSignIn(credential);
        if (data.needsUsername) {
          const state = { signupToken: data.signupToken, suggestion: data.suggestion };
          rememberGoogleStep(GOOGLE_SIGNUP_KEY, state);
          navigate(withNext('/signup/username', next), { state });
        } else if (data.needsLink) {
          goToGoogleLink(navigate, data, next);
        }
      } catch (err) {
        onError?.(err.message);
      }
    };
  }, [googleSignIn, navigate, next, onError]);

  useEffect(() => {
    if (!CLIENT_ID) return undefined;
    let cancelled = false;

    loadGoogleScript()
      .then((google) => {
        if (cancelled || !containerRef.current) return;
        if (!initialised) {
          google.accounts.id.initialize({
            client_id: CLIENT_ID,
            callback: (response) => handleCredential?.(response),
            ux_mode: 'popup',
          });
          initialised = true;
        }
        const width = Math.max(200, Math.min(400, containerRef.current.offsetWidth));
        containerRef.current.replaceChildren();
        google.accounts.id.renderButton(containerRef.current, {
          theme: resolvedTheme === 'dark' ? 'filled_black' : 'outline',
          shape: 'pill',
          text: 'continue_with',
          size: 'large',
          width,
        });
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });

    return () => {
      cancelled = true;
    };
  }, [resolvedTheme]);

  if (!CLIENT_ID) return null;
  if (failed) return <p className={styles.failed}>Google sign-in is unavailable right now.</p>;
  return <div ref={containerRef} className={styles.button} />;
}
