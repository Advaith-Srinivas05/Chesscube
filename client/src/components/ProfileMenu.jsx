import { useEffect, useId, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import Avatar from './Avatar.jsx';
import { useToast } from './ui/Toast.jsx';
import styles from './ProfileMenu.module.css';

export default function ProfileMenu() {
  const { user, signOut } = useAuth();
  const toast = useToast();
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);
  const buttonRef = useRef(null);
  const menuRef = useRef(null);
  const menuId = useId();

  const items = () => [...(menuRef.current?.querySelectorAll('[role="menuitem"]') ?? [])];

  useEffect(() => setOpen(false), [location.pathname]);

  useEffect(() => {
    if (!open) return undefined;
    items()[0]?.focus();
    const onPointerDown = (event) => {
      if (!rootRef.current?.contains(event.target)) setOpen(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [open]);

  function close({ focusButton = true } = {}) {
    setOpen(false);
    if (focusButton) buttonRef.current?.focus();
  }

  function handleMenuKeyDown(event) {
    const list = items();
    const index = list.indexOf(document.activeElement);
    const moves = { ArrowDown: index + 1, ArrowUp: index - 1, Home: 0, End: list.length - 1 };
    if (event.key in moves) {
      event.preventDefault();
      list[(moves[event.key] + list.length) % list.length]?.focus();
    } else if (event.key === 'Escape') {
      event.preventDefault();
      close();
    } else if (event.key === 'Tab') {
      close({ focusButton: false });
    }
  }

  function handleButtonKeyDown(event) {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      setOpen(true);
    }
  }

  async function handleSignOut() {
    close();
    try {
      await signOut();
      toast.show('Signed out');
    } catch {
      toast.show('Signed out on this device', { tone: 'info' });
    }
  }

  return (
    <div ref={rootRef} className={styles.root}>
      <button
        ref={buttonRef}
        type="button"
        className={`${styles.trigger} ${open ? styles.triggerOpen : ''}`}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        aria-label={`Account menu for ${user.username}`}
        onClick={() => setOpen((value) => !value)}
        onKeyDown={handleButtonKeyDown}
      >
        <Avatar id={user.avatar} size={32} />
      </button>

      {open && (
        <div ref={menuRef} id={menuId} role="menu" aria-label="Account" className={styles.menu} onKeyDown={handleMenuKeyDown}>
          <div className={styles.header}>
            <Avatar id={user.avatar} size={40} />
            <div className={styles.identity}>
              <span className={styles.username}>{user.username}</span>
              <span className={styles.email}>{user.email}</span>
            </div>
          </div>
          <Link to="/profile" role="menuitem" tabIndex={-1} className={styles.item}>
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <circle cx="12" cy="8" r="4" />
              <path d="M4.5 20.5a7.5 7.5 0 0 1 15 0" />
            </svg>
            Profile
          </Link>
          <button type="button" role="menuitem" tabIndex={-1} className={styles.item} onClick={handleSignOut}>
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3M10 17l-5-5 5-5M5 12h11" />
            </svg>
            Sign out
          </button>
        </div>
      )}
    </div>
  );
}
