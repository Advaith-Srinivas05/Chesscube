import { useMemo } from 'react';
import { Chessboard } from 'react-chessboard';
import { useSettings } from '../context/SettingsContext.jsx';
import { BOARD_THEMES, PIECE_CODES, pieceUrl } from '../data/boardOptions.js';
import styles from './ChessBoard.module.css';

// Square board that fills the width of its container, using the player's chosen piece set and colours.
export default function ChessBoard({ id, position, orientation = 'white', allowDragging = false }) {
  const { settings } = useSettings();

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

  const colors = BOARD_THEMES.find((theme) => theme.id === settings.boardTheme) ?? BOARD_THEMES[0];

  return (
    <div className={styles.board}>
      <Chessboard
        options={{
          id,
          position,
          boardOrientation: orientation,
          pieces,
          allowDragging,
          boardStyle: { borderRadius: '6px', overflow: 'hidden' },
          darkSquareStyle: { backgroundColor: colors.dark },
          lightSquareStyle: { backgroundColor: colors.light },
          darkSquareNotationStyle: { color: colors.light },
          lightSquareNotationStyle: { color: colors.dark },
        }}
      />
    </div>
  );
}
