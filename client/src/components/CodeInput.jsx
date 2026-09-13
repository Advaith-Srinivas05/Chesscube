import { useLayoutEffect, useRef } from 'react';
import styles from './CodeInput.module.css';

const LENGTH = 6;

// Six single-digit boxes for emailed codes. `value` is a string of up to 6 digits with no gaps.
export default function CodeInput({ value, onChange, onComplete, disabled = false, invalid = false, autoFocus = false, label = 'Verification code' }) {
  const inputsRef = useRef([]);
  const pendingFocusRef = useRef(null);

  const focusBox = (index) => inputsRef.current[Math.max(0, Math.min(LENGTH - 1, index))]?.focus();

  // Focus moves after the new value has rendered; otherwise handleFocus would still see the old value.
  useLayoutEffect(() => {
    if (pendingFocusRef.current === null) return;
    focusBox(pendingFocusRef.current);
    pendingFocusRef.current = null;
  });

  function update(next, focusIndex) {
    const clean = next.replace(/\D/g, '').slice(0, LENGTH);
    if (clean === value) {
      if (focusIndex !== undefined) focusBox(focusIndex);
      return;
    }
    pendingFocusRef.current = focusIndex ?? null;
    onChange(clean);
    if (clean.length === LENGTH) onComplete?.(clean);
  }

  function handleInput(index, event) {
    // A single keystroke uses just the typed character, even if the caret sat next to an existing digit.
    const { inputType, data } = event.nativeEvent;
    const typed = ((inputType === 'insertText' ? data : event.target.value) ?? '').replace(/\D/g, '');
    if (!typed) return;
    // Several digits at once (autofill or a mobile keyboard suggestion): fill from this box onwards.
    const next = value.slice(0, index) + typed + value.slice(index + typed.length);
    update(next, index + typed.length);
  }

  function handleKeyDown(index, event) {
    if (event.key === 'Backspace') {
      event.preventDefault();
      if (value[index]) {
        update(value.slice(0, index) + value.slice(index + 1), index);
      } else if (index > 0) {
        update(value.slice(0, index - 1) + value.slice(index), index - 1);
      }
    } else if (event.key === 'ArrowLeft') {
      event.preventDefault();
      focusBox(index - 1);
    } else if (event.key === 'ArrowRight') {
      event.preventDefault();
      focusBox(Math.min(index + 1, value.length));
    }
  }

  function handlePaste(event) {
    const pasted = event.clipboardData.getData('text').replace(/\D/g, '');
    if (!pasted) return;
    event.preventDefault();
    update(pasted, Math.min(pasted.length, LENGTH - 1));
  }

  // Keep the digits contiguous: clicking past the end focuses the next empty box.
  function handleFocus(index, event) {
    if (index > value.length) focusBox(value.length);
    else event.target.select();
  }

  return (
    <div className={styles.group} role="group" aria-label={label}>
      {Array.from({ length: LENGTH }, (_, index) => (
        <input
          key={index}
          ref={(element) => {
            inputsRef.current[index] = element;
          }}
          className={`${styles.box} ${invalid ? styles.invalid : ''}`}
          type="text"
          inputMode="numeric"
          autoComplete={index === 0 ? 'one-time-code' : 'off'}
          aria-label={`Digit ${index + 1} of ${LENGTH}`}
          aria-invalid={invalid || undefined}
          value={value[index] ?? ''}
          disabled={disabled}
          autoFocus={autoFocus && index === 0}
          onChange={(event) => handleInput(index, event)}
          onKeyDown={(event) => handleKeyDown(index, event)}
          onPaste={handlePaste}
          onFocus={(event) => handleFocus(index, event)}
        />
      ))}
    </div>
  );
}
