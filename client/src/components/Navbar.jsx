import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { useSettings } from '../context/SettingsContext.jsx';
import Logo from './Logo.jsx';
import ProfileMenu from './ProfileMenu.jsx';
import styles from './Navbar.module.css';

const LINKS = [
  { to: '/', label: 'Home' },
  { to: '/play', label: 'Play' },
  { to: '/puzzles', label: 'Puzzles' },
  { to: '/learn', label: 'Learn' },
  { to: '/leaderboard', label: 'Leaderboard' },
  { to: '/socials', label: 'Socials' },
];

function linkClass({ isActive }) {
  return isActive ? `${styles.link} ${styles.active}` : styles.link;
}

function SunIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M20.5 14.5A8.5 8.5 0 0 1 9.5 3.5a8.5 8.5 0 1 0 11 11Z" />
    </svg>
  );
}

function GearIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z" />
    </svg>
  );
}

// One underline for the desktop links that slides to the active link (Web Animations, so a re-measure during the
// slide, e.g. the scrollbar appearing on the new page, only moves its end point). First render and resizes jump;
// pages without a nav link (Settings, Profile, ...) fade it out.
const SLIDE = { duration: 300, easing: 'cubic-bezier(0.4, 0, 0.2, 1)' };

function useUnderline(linksRef, underlineRef, pathname, deps) {
  const last = useRef(null); // { link, frame }

  useLayoutEffect(() => {
    const container = linksRef.current;
    const line = underlineRef.current;
    if (!container || !line) return undefined;

    function place(fromNavigation) {
      const active = container.querySelector('[aria-current="page"]');
      if (!active) {
        last.current = null;
        line.style.opacity = '0';
        return;
      }
      const frame = {
        transform: `translate(${active.offsetLeft}px, ${active.offsetTop + active.offsetHeight}px)`,
        width: `${active.offsetWidth}px`,
      };
      const previous = last.current;
      last.current = { link: active, frame };
      Object.assign(line.style, frame, { opacity: '1' });

      const running = line.getAnimations().find((animation) => animation.id === 'slide');
      if (running && !fromNavigation) {
        running.effect.setKeyframes([running.effect.getKeyframes()[0], frame]);
        return;
      }
      const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      if (fromNavigation && previous && previous.link !== active && !reduced) {
        running?.cancel();
        const slide = line.animate([previous.frame, frame], SLIDE);
        slide.id = 'slide';
      }
    }

    place(true);
    const observer = new ResizeObserver(() => place(false));
    observer.observe(container);
    document.fonts?.ready.then(() => place(false));
    return () => observer.disconnect();
  }, [pathname, ...deps]);
}

export default function Navbar() {
  const { resolvedTheme, updateSettings } = useSettings();
  const { user, status } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const location = useLocation();
  const linksRef = useRef(null);
  const underlineRef = useRef(null);

  useEffect(() => setMenuOpen(false), [location.pathname]);

  const isDark = resolvedTheme === 'dark';
  const requests = user?.incomingRequests ?? 0;
  useUnderline(linksRef, underlineRef, location.pathname, [requests > 0]);

  return (
    <header className={styles.header}>
      <nav className={styles.nav}>
        <Link to="/" className={styles.brand} aria-label="Chesscube home">
          <Logo />
        </Link>

        <div ref={linksRef} className={`${styles.links} ${menuOpen ? styles.linksOpen : ''}`}>
          <span ref={underlineRef} className={styles.underline} aria-hidden="true" />
          {LINKS.map(({ to, label }) => (
            <NavLink key={to} to={to} end={to === '/'} className={linkClass}>
              {label}
              {to === '/socials' && requests > 0 && (
                <>
                  <span className={styles.badge} aria-hidden="true">
                    {requests > 99 ? '99+' : requests}
                  </span>
                  <span className="sr-only">, {requests} friend {requests === 1 ? 'request' : 'requests'}</span>
                </>
              )}
            </NavLink>
          ))}
        </div>

        <div className={styles.actions}>
          <button
            type="button"
            className={styles.iconButton}
            aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
            onClick={() => updateSettings({ theme: isDark ? 'light' : 'dark' })}
          >
            {isDark ? <SunIcon /> : <MoonIcon />}
          </button>
          <NavLink
            to="/settings"
            className={({ isActive }) => `${styles.iconButton} ${isActive ? styles.iconActive : ''}`}
            aria-label="Settings"
          >
            <GearIcon />
          </NavLink>
          {status === 'loading' ? (
            <span className={styles.accountPlaceholder} aria-hidden="true" />
          ) : user ? (
            <ProfileMenu />
          ) : (
            <Link to="/signin" className={styles.signIn}>
              Sign in
            </Link>
          )}
          <button
            type="button"
            className={`${styles.iconButton} ${styles.menuToggle}`}
            aria-label={requests > 0 ? 'Toggle navigation (new friend requests)' : 'Toggle navigation'}
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((value) => !value)}
          >
            {requests > 0 && !menuOpen && <span className={styles.menuDot} aria-hidden="true" />}
            <svg viewBox="0 0 24 24" aria-hidden="true">
              {menuOpen ? <path d="M6 6l12 12M18 6L6 18" /> : <path d="M4 7h16M4 12h16M4 17h16" />}
            </svg>
          </button>
        </div>
      </nav>
    </header>
  );
}
