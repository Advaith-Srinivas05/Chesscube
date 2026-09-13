import ChessBoard from '../components/ChessBoard.jsx';
import { useSettings } from '../context/SettingsContext.jsx';
import { BOARD_THEMES, PIECE_SETS, pieceUrl } from '../data/boardOptions.js';
import styles from './Settings.module.css';

const THEMES = [
  { id: 'system', name: 'System' },
  { id: 'light', name: 'Light' },
  { id: 'dark', name: 'Dark' },
];

export default function Settings() {
  const { settings, updateSettings } = useSettings();

  return (
    <div className="page">
      <h1 className={styles.title}>Settings</h1>

      <div className={styles.layout}>
        <div className={styles.sections}>
          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>Appearance</h2>
            <div className={styles.field}>
              <span className={styles.label}>Theme</span>
              <div className={styles.segmented} role="radiogroup" aria-label="Theme">
                {THEMES.map(({ id, name }) => (
                  <button
                    key={id}
                    type="button"
                    role="radio"
                    aria-checked={settings.theme === id}
                    className={`${styles.segment} ${settings.theme === id ? styles.selected : ''}`}
                    onClick={() => updateSettings({ theme: id })}
                  >
                    {name}
                  </button>
                ))}
              </div>
            </div>
          </section>

          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>Game</h2>

            <div className={styles.field}>
              <span className={styles.label}>Chess set</span>
              <div className={styles.grid} role="radiogroup" aria-label="Chess set">
                {PIECE_SETS.map(({ id, name }) => (
                  <button
                    key={id}
                    type="button"
                    role="radio"
                    aria-checked={settings.pieceSet === id}
                    className={`${styles.option} ${settings.pieceSet === id ? styles.selected : ''}`}
                    onClick={() => updateSettings({ pieceSet: id })}
                  >
                    <span className={styles.pieces}>
                      <img src={pieceUrl(id, 'wN')} alt="" />
                      <img src={pieceUrl(id, 'bQ')} alt="" />
                    </span>
                    <span className={styles.optionName}>{name}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className={styles.field}>
              <span className={styles.label}>Board colours</span>
              <div className={styles.grid} role="radiogroup" aria-label="Board colours">
                {BOARD_THEMES.map(({ id, name, light, dark }) => (
                  <button
                    key={id}
                    type="button"
                    role="radio"
                    aria-checked={settings.boardTheme === id}
                    className={`${styles.option} ${settings.boardTheme === id ? styles.selected : ''}`}
                    onClick={() => updateSettings({ boardTheme: id })}
                  >
                    <span className={styles.swatch} style={{ '--light': light, '--dark': dark }} />
                    <span className={styles.optionName}>{name}</span>
                  </button>
                ))}
              </div>
            </div>
          </section>
        </div>

        <aside className={styles.preview}>
          <span className={styles.label}>Preview</span>
          <ChessBoard id="settings-preview" />
        </aside>
      </div>
    </div>
  );
}
