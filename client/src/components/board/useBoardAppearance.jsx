import { useMemo } from 'react';
import { useSettings } from '../../context/SettingsContext.jsx';
import { BOARD_THEMES, PIECE_CODES, pieceUrl } from '../../data/boardOptions.js';
import styles from './Board.module.css';

// react-chessboard options for the player's piece set and board colours, shared by every board.
export default function useBoardAppearance() {
  const { settings } = useSettings();
  const colors = BOARD_THEMES.find((theme) => theme.id === settings.boardTheme) ?? BOARD_THEMES[0];

  const pieces = useMemo(
    () =>
      Object.fromEntries(
        PIECE_CODES.map((code) => [
          code,
          () => <img className={styles.piece} src={pieceUrl(settings.pieceSet, code)} alt="" draggable={false} />,
        ])
      ),
    [settings.pieceSet]
  );

  return useMemo(
    () => ({
      pieceSet: settings.pieceSet,
      colors,
      options: {
        pieces,
        boardStyle: { borderRadius: '6px', overflow: 'hidden' },
        darkSquareStyle: { backgroundColor: colors.dark },
        lightSquareStyle: { backgroundColor: colors.light },
        darkSquareNotationStyle: { color: colors.light },
        lightSquareNotationStyle: { color: colors.dark },
      },
    }),
    [settings.pieceSet, colors, pieces]
  );
}
