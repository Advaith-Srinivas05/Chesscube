import { useEffect, useMemo, useRef, useState } from 'react';
import { Chessboard } from 'react-chessboard';
import { useSettings } from '../../context/SettingsContext.jsx';
import { premoveDests as geometryDests } from '../../lib/chess/premove.js';
import styles from './Board.module.css';
import PromotionPicker from './PromotionPicker.jsx';
import useBoardAppearance from './useBoardAppearance.jsx';

// Overlays sit on top of any board theme, so they use fixed translucent colours.
const TINT = 'rgba(255, 196, 64, 0.38)';
const PREMOVE_TINT = 'rgba(40, 70, 160, 0.34)';
const DOT = 'rgba(0, 0, 0, 0.22)';
const PREMOVE_DOT = 'rgba(40, 70, 160, 0.42)';
const HIGHLIGHTS = { good: 'rgba(70, 160, 70, 0.55)', bad: 'rgba(205, 55, 45, 0.55)' };

const fill = (color) => `linear-gradient(${color}, ${color})`;
const dot = (color) => `radial-gradient(circle, ${color} 19%, transparent 20%)`;
const ring = (color) => `radial-gradient(transparent 0 60%, ${color} 61% 72%, transparent 73%)`;
const CHECK = 'radial-gradient(circle, rgba(220, 40, 40, 0.95) 0%, rgba(220, 40, 40, 0.6) 40%, transparent 78%)';

const colorOf = (pieceType) => (pieceType?.[0] === 'w' ? 'white' : pieceType?.[0] === 'b' ? 'black' : null);

// Square name → piece code ('wP', 'bK', ...) from the board part of a FEN.
function piecesFromFen(fen) {
  const pieces = new Map();
  const rows = String(fen ?? '').split(' ')[0].split('/');
  rows.forEach((row, index) => {
    let file = 0;
    for (const char of row) {
      if (/\d/.test(char)) {
        file += Number(char);
      } else {
        const color = char === char.toUpperCase() ? 'w' : 'b';
        pieces.set(`${'abcdefgh'[file]}${8 - index}`, `${color}${char.toUpperCase()}`);
        file += 1;
      }
    }
  });
  return pieces;
}

/**
 * Playable board. The parent owns the game: it passes the position and legal destinations and
 * applies moves from `onMove`. Premoves are enabled by passing `onPremove`.
 * `showDests` and `autoQueen` default to the player's settings.
 * `highlights` tints squares for feedback: { e4: 'good' | 'bad' }.
 */
export default function InteractiveBoard({
  id = 'board',
  fen,
  orientation = 'white',
  movableColor = null,
  turn = 'white',
  dests,
  lastMove = null,
  check = null,
  onMove,
  viewOnly = false,
  showDests,
  autoQueen,
  premove = null,
  onPremove,
  onCancelPremove,
  variant = 'standard',
  highlights = null,
}) {
  const { settings } = useSettings();
  const { options: appearance, pieceSet } = useBoardAppearance();
  const [selected, setSelected] = useState(null);
  const [promotion, setPromotion] = useState(null);
  const droppedRef = useRef(false);

  const dotsVisible = showDests ?? settings.showLegalMoves ?? true;
  const queenAlways = autoQueen ?? settings.autoQueen ?? false;
  const pieces = useMemo(() => piecesFromFen(fen), [fen]);

  const canMove = !viewOnly && Boolean(movableColor) && (movableColor === 'both' || movableColor === turn);
  const canPremove =
    !viewOnly && Boolean(onPremove) && Boolean(movableColor) && movableColor !== 'both' && movableColor !== turn;

  const isOwn = (square) => {
    const color = colorOf(pieces.get(square));
    return Boolean(color) && (movableColor === 'both' ? color === turn : color === movableColor);
  };

  const targetsFor = (square) => {
    if (!square || !isOwn(square)) return [];
    if (canMove) return dests?.get(square) ?? [];
    if (canPremove) return geometryDests(fen, square, variant);
    return [];
  };

  // targetsFor only reads these values.
  const targets = useMemo(() => targetsFor(selected), [selected, pieces, dests, canMove, canPremove, movableColor, turn, variant]);

  // Drop the selection when the position changes under it, and never keep a stale promotion open.
  useEffect(() => {
    setPromotion(null);
    setSelected((current) => (current && isOwn(current) && (canMove || canPremove) ? current : null));
  }, [fen, viewOnly, movableColor]);

  const isPromotion = (from, to) => {
    const piece = pieces.get(from);
    return piece?.[1] === 'P' && to[1] === (piece[0] === 'w' ? '8' : '1');
  };

  // Returns true when the move (or premove) was sent to the parent straight away.
  function tryMove(from, to) {
    if (!targetsFor(from).includes(to)) return false;
    setSelected(null);
    if (canPremove) {
      onPremove({ from, to, ...(isPromotion(from, to) ? { promotion: 'q' } : {}) });
      return false;
    }
    if (isPromotion(from, to) && !queenAlways) {
      setPromotion({ from, to, color: colorOf(pieces.get(from)) });
      return false;
    }
    onMove?.({ from, to, ...(isPromotion(from, to) ? { promotion: 'q' } : {}) });
    return true;
  }

  function handleSquareClick({ square }) {
    // A drag that ends on its own square also fires a click; the drop already handled it.
    if (droppedRef.current) return;
    if (selected && targets.includes(square)) {
      tryMove(selected, square);
      return;
    }
    if ((canMove || canPremove) && isOwn(square)) {
      setSelected(selected === square ? null : square);
      return;
    }
    setSelected(null);
    if (premove) onCancelPremove?.();
  }

  function handleRightClick() {
    setSelected(null);
    if (premove) onCancelPremove?.();
  }

  function markDropped() {
    droppedRef.current = true;
    setTimeout(() => {
      droppedRef.current = false;
    }, 0);
  }

  function handlePieceDrop({ sourceSquare, targetSquare }) {
    markDropped();
    if (!targetSquare || targetSquare === sourceSquare) return false;
    if (!targetsFor(sourceSquare).includes(targetSquare)) {
      setSelected(null);
      return false;
    }
    return tryMove(sourceSquare, targetSquare);
  }

  function choosePromotion(role) {
    const { from, to } = promotion;
    setPromotion(null);
    onMove?.({ from, to, promotion: role });
  }

  const squareStyles = useMemo(() => {
    const layers = {};
    const add = (square, layer) => {
      if (square) (layers[square] ??= []).push(layer);
    };

    if (check) add(check, CHECK);
    if (dotsVisible || canPremove) {
      for (const square of targets) {
        const color = canPremove ? PREMOVE_DOT : DOT;
        add(square, pieces.has(square) ? ring(color) : dot(color));
      }
    }
    if (selected) add(selected, fill(canPremove ? PREMOVE_TINT : TINT));
    if (premove) {
      add(premove.from, fill(PREMOVE_TINT));
      add(premove.to, fill(PREMOVE_TINT));
    }
    for (const [square, kind] of Object.entries(highlights ?? {})) {
      if (HIGHLIGHTS[kind]) add(square, fill(HIGHLIGHTS[kind]));
    }
    if (lastMove) {
      add(lastMove[0], fill(TINT));
      add(lastMove[1], fill(TINT));
    }

    return Object.fromEntries(Object.entries(layers).map(([square, list]) => [square, { background: list.join(', ') }]));
  }, [check, dotsVisible, canPremove, targets, pieces, selected, premove, highlights, lastMove]);

  return (
    <div className={styles.board} onContextMenu={(event) => event.preventDefault()}>
      <Chessboard
        options={{
          ...appearance,
          id,
          position: fen,
          boardOrientation: orientation,
          squareStyles,
          allowDragging: !viewOnly && (canMove || canPremove),
          dragActivationDistance: 4,
          canDragPiece: ({ square }) => (canMove || canPremove) && isOwn(square),
          onPieceDrag: ({ square }) => setSelected(square),
          onPieceDrop: handlePieceDrop,
          onSquareClick: handleSquareClick,
          onSquareRightClick: handleRightClick,
          dropSquareStyle: { boxShadow: 'inset 0 0 0 3px rgba(255, 255, 255, 0.55)' },
          allowDrawingArrows: true,
          clearArrowsOnPositionChange: true,
          animationDurationInMs: 200,
        }}
      />
      {promotion && (
        <PromotionPicker
          square={promotion.to}
          color={promotion.color}
          orientation={orientation}
          pieceSet={pieceSet}
          onSelect={choosePromotion}
          onCancel={() => setPromotion(null)}
        />
      )}
    </div>
  );
}
