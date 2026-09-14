import styles from './GameView.module.css';

const KEY_ACTIONS = { ArrowLeft: 'prev', ArrowRight: 'next', Home: 'first', End: 'last' };

/**
 * Game screen layout. Every part is a slot; state lives in a controller hook.
 * onNavigate(action) receives 'first' | 'prev' | 'next' | 'last' from the arrow, Home and End keys.
 * With `viewingHistory`, a "Back to game" button appears under the board (onBackToGame).
 */
export default function GameView({
  board,
  topBar,
  bottomBar,
  moveList,
  prompt,
  controls,
  result,
  onNavigate,
  viewingHistory = false,
  onBackToGame,
  label = 'Game',
}) {
  function handleKeyDown(event) {
    const action = KEY_ACTIONS[event.key];
    if (!action || !onNavigate) return;
    if (event.target.closest('input, textarea, select, [contenteditable="true"]')) return;
    event.preventDefault();
    onNavigate(action);
  }

  return (
    <div className={styles.view} tabIndex={-1} onKeyDown={handleKeyDown} aria-label={label} role="region">
      <div className={styles.boardColumn}>
        {topBar}
        <div className={styles.boardWrap}>
          {board}
          {viewingHistory && (
            <button type="button" className={styles.backToGame} onClick={onBackToGame}>
              Back to game
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M8 5l8 7-8 7" />
              </svg>
            </button>
          )}
        </div>
        {bottomBar}
      </div>

      <aside className={styles.panel} aria-label="Game panel">
        {moveList}
        {prompt}
        {controls}
        {result}
      </aside>
    </div>
  );
}
