import ChessBoard from '../components/ChessBoard.jsx';
import Switch from '../components/ui/Switch.jsx';
import { useSettings } from '../context/SettingsContext.jsx';
import { BOARD_THEMES, PIECE_SETS, pieceUrl } from '../data/boardOptions.js';
import { previewSoundTheme, SOUND_THEMES } from '../lib/sounds.js';
import styles from './Settings.module.css';

const THEMES = [
  { id: 'system', name: 'System' },
  { id: 'light', name: 'Light' },
  { id: 'dark', name: 'Dark' },
];

const GAMEPLAY = [
  { key: 'showLegalMoves', label: 'Show legal moves', description: 'Dots mark where a selected piece can go.' },
  { key: 'premoves', label: 'Premoves', description: "Queue a move while it's your opponent's turn." },
  { key: 'autoQueen', label: 'Always promote to a queen', description: 'Skip the promotion picker.' },
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

          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>Gameplay</h2>
            <div className={styles.switches}>
              {GAMEPLAY.map(({ key, label, description }) => (
                <Switch
                  key={key}
                  label={label}
                  description={description}
                  checked={settings[key]}
                  onChange={(value) => updateSettings({ [key]: value })}
                />
              ))}
            </div>
          </section>

          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>Sound</h2>
            <Switch
              label="Sounds"
              description="Play sounds for moves, captures, checks and low time."
              checked={settings.sounds}
              onChange={(sounds) => updateSettings({ sounds })}
            />
            <div className={`${styles.field} ${styles.soundField}`}>
              <span className={styles.label} id="sound-theme-label">
                Sound theme
              </span>
              <div
                className={`${styles.soundThemes} ${settings.sounds ? '' : styles.muted}`}
                role="radiogroup"
                aria-labelledby="sound-theme-label"
              >
                {SOUND_THEMES.map(({ id, name, description }) => {
                  const selected = settings.soundTheme === id;
                  return (
                    <div key={id} className={`${styles.soundTheme} ${selected ? styles.selected : ''}`}>
                      <button
                        type="button"
                        role="radio"
                        aria-checked={selected}
                        disabled={!settings.sounds}
                        className={styles.soundChoice}
                        onClick={() => {
                          updateSettings({ soundTheme: id });
                          previewSoundTheme(id);
                        }}
                      >
                        <span className={styles.optionName}>{name}</span>
                        <span className={styles.soundDescription}>{description}</span>
                      </button>
                      <button
                        type="button"
                        className={styles.playButton}
                        aria-label={`Preview ${name}`}
                        title={`Preview ${name}`}
                        disabled={!settings.sounds}
                        onClick={() => previewSoundTheme(id)}
                      >
                        <svg viewBox="0 0 24 24" aria-hidden="true">
                          <path d="M8 5.5v13l10.5-6.5z" />
                        </svg>
                      </button>
                    </div>
                  );
                })}
              </div>
              {!settings.sounds && <p className={styles.hint}>Turn sounds on to choose a theme.</p>}
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
