import { Chessboard } from 'react-chessboard';
import styles from './board/Board.module.css';
import useBoardAppearance from './board/useBoardAppearance.jsx';

// Static square board that fills the width of its container, using the player's chosen piece set and colours.
export default function ChessBoard({ id, position, orientation = 'white', allowDragging = false, showNotation = true }) {
  const { options } = useBoardAppearance();

  return (
    <div className={styles.board}>
      <Chessboard options={{ ...options, id, position, boardOrientation: orientation, allowDragging, showNotation }} />
    </div>
  );
}
