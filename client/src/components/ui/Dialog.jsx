import { useEffect, useId, useRef } from 'react';
import { pushModal, removeModal } from './modalStack.js';
import styles from './Dialog.module.css';

// Modal built on the native <dialog>. Closes on Esc, backdrop click and the close button; the parent owns `open`.
export default function Dialog({ open, onClose, title, children, footer, className = '' }) {
  const dialogRef = useRef(null);
  const returnFocusRef = useRef(null);
  const pressedBackdropRef = useRef(false);
  const titleId = useId();

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!open || !dialog) return;

    returnFocusRef.current = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    if (!dialog.open) dialog.showModal();
    pushModal(dialog);

    return () => {
      removeModal(dialog);
      document.body.style.overflow = previousOverflow;
      if (dialog.open) dialog.close();
      const target = returnFocusRef.current;
      if (target?.isConnected) target.focus();
    };
  }, [open]);

  function handleCancel(event) {
    // Esc: let the parent decide, so `open` stays the single source of truth.
    event.preventDefault();
    onClose();
  }

  // Only a press that both starts and ends on the backdrop closes, so drag-selecting text inside doesn't.
  function handlePointerDown(event) {
    pressedBackdropRef.current = event.target === dialogRef.current;
  }

  function handleClick(event) {
    if (pressedBackdropRef.current && event.target === dialogRef.current) onClose();
    pressedBackdropRef.current = false;
  }

  return (
    <dialog
      ref={dialogRef}
      className={`${styles.dialog} ${className}`}
      aria-labelledby={title ? titleId : undefined}
      onCancel={handleCancel}
      onPointerDown={handlePointerDown}
      onClick={handleClick}
    >
      {open && (
        <div className={styles.content}>
          <header className={styles.header}>
            {title && (
              <h2 id={titleId} className={styles.title}>
                {title}
              </h2>
            )}
            <button type="button" className={styles.close} onClick={onClose} aria-label="Close">
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M6 6l12 12M18 6L6 18" />
              </svg>
            </button>
          </header>
          <div className={styles.body}>{children}</div>
          {footer && <footer className={styles.footer}>{footer}</footer>}
        </div>
      )}
    </dialog>
  );
}
