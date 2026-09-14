import { useEffect, useId, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import styles from './Menu.module.css';

// Dropdown menu. `children` is the trigger's content; items: [{ label, to?, onSelect?, danger? }].
export default function Menu({ label, items, children, triggerClassName = '', align = 'end' }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);
  const buttonRef = useRef(null);
  const menuRef = useRef(null);
  const menuId = useId();

  const menuItems = () => [...(menuRef.current?.querySelectorAll('[role="menuitem"]') ?? [])];

  useEffect(() => {
    if (!open) return undefined;
    menuItems()[0]?.focus();
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
    const list = menuItems();
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

  return (
    <div ref={rootRef} className={styles.root}>
      <button
        ref={buttonRef}
        type="button"
        className={triggerClassName}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        aria-label={label}
        onClick={() => setOpen((value) => !value)}
        onKeyDown={handleButtonKeyDown}
      >
        {children}
      </button>

      {open && (
        <div
          ref={menuRef}
          id={menuId}
          role="menu"
          className={`${styles.menu} ${align === 'start' ? styles.start : ''}`}
          onKeyDown={handleMenuKeyDown}
        >
          {items.map((item) => {
            const className = `${styles.item} ${item.danger ? styles.danger : ''}`;
            return item.to ? (
              <Link key={item.label} to={item.to} role="menuitem" tabIndex={-1} className={className}>
                {item.label}
              </Link>
            ) : (
              <button
                key={item.label}
                type="button"
                role="menuitem"
                tabIndex={-1}
                className={className}
                onClick={() => {
                  close();
                  item.onSelect();
                }}
              >
                {item.label}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
