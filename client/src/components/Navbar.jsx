import { useEffect, useRef, useState } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import { useSettings } from '../context/SettingsContext.jsx';
import Logo from './Logo.jsx';
import styles from './Navbar.module.css';

const LINKS = [
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

function UserIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21a8 8 0 0 1 16 0" />
    </svg>
  );
}

function AccountMenu() {
  const [open, setOpen] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event) => {
      if (!menuRef.current?.contains(event.target)) setOpen(false);
    };
    const onKeyDown = (event) => event.key === 'Escape' && setOpen(false);
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  return (
    <div className={styles.account} ref={menuRef}>
      <button
        type="button"
        className={styles.iconButton}
        aria-label="Account menu"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        <UserIcon />
      </button>
      {open && (
        <div className={styles.dropdown} role="menu">
          <Link to="/profile" role="menuitem" className={styles.dropdownItem} onClick={() => setOpen(false)}>
            Profile
          </Link>
          <Link to="/settings" role="menuitem" className={styles.dropdownItem} onClick={() => setOpen(false)}>
            Settings
          </Link>
        </div>
      )}
    </div>
  );
}

export default function Navbar() {
  const { resolvedTheme, updateSettings } = useSettings();
  const [menuOpen, setMenuOpen] = useState(false);
  const location = useLocation();

  useEffect(() => setMenuOpen(false), [location.pathname]);

  const isDark = resolvedTheme === 'dark';

  return (
    <header className={styles.header}>
      <nav className={styles.nav}>
        <Link to="/" className={styles.brand} aria-label="Home">
          <Logo />
        </Link>

        <div className={`${styles.links} ${menuOpen ? styles.linksOpen : ''}`}>
          {LINKS.map(({ to, label }) => (
            <NavLink key={to} to={to} className={linkClass}>
              {label}
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
          <Link to="/signin" className={styles.signIn}>
            Sign in
          </Link>
          <AccountMenu />
          <button
            type="button"
            className={`${styles.iconButton} ${styles.menuToggle}`}
            aria-label="Toggle navigation"
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((value) => !value)}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              {menuOpen ? <path d="M6 6l12 12M18 6L6 18" /> : <path d="M4 7h16M4 12h16M4 17h16" />}
            </svg>
          </button>
        </div>
      </nav>
    </header>
  );
}
