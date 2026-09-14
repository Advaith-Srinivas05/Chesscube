import { createContext, useContext, useEffect, useState } from 'react';
import { BOARD_THEMES, PIECE_SETS } from '../data/boardOptions.js';
import { DEFAULT_SOUND_THEME } from '../lib/sounds.js';

const STORAGE_KEY = 'settings';

const DEFAULTS = {
  theme: 'system', // 'system' | 'light' | 'dark'
  pieceSet: PIECE_SETS[0].id,
  boardTheme: BOARD_THEMES[0].id,
  showLegalMoves: true,
  premoves: true,
  autoQueen: false,
  sounds: true,
  soundTheme: DEFAULT_SOUND_THEME,
};

function loadSettings() {
  try {
    return { ...DEFAULTS, ...JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}') };
  } catch {
    return DEFAULTS;
  }
}

const darkQuery = window.matchMedia('(prefers-color-scheme: dark)');

const SettingsContext = createContext(null);

// Stored in localStorage so settings work without an account.
export function SettingsProvider({ children }) {
  const [settings, setSettings] = useState(loadSettings);
  const [systemDark, setSystemDark] = useState(darkQuery.matches);

  useEffect(() => {
    const onChange = (event) => setSystemDark(event.matches);
    darkQuery.addEventListener('change', onChange);
    return () => darkQuery.removeEventListener('change', onChange);
  }, []);

  const resolvedTheme = settings.theme === 'system' ? (systemDark ? 'dark' : 'light') : settings.theme;

  useEffect(() => {
    document.documentElement.dataset.theme = resolvedTheme;
  }, [resolvedTheme]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    } catch {
      // Storage unavailable (private mode); settings still apply for this visit.
    }
  }, [settings]);

  const updateSettings = (changes) => setSettings((current) => ({ ...current, ...changes }));

  return (
    <SettingsContext.Provider value={{ settings, resolvedTheme, updateSettings }}>
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings() {
  const context = useContext(SettingsContext);
  if (!context) throw new Error('useSettings must be used inside SettingsProvider');
  return context;
}
