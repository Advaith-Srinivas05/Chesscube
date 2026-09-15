import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { FIRST_MOVE_MS, GameSession, MAX_DRAW_OFFERS } from '../src/realtime/GameSession.js';

const player = (id) => ({ id, kind: 'guest', username: id, avatar: null, rating: null, provisional: false });

function newGame(options = {}) {
  return new GameSession({
    id: 'test1234',
    tc: { base: 60, inc: 0 },
    category: 'bullet',
    population: 'guests',
    white: player('w'),
    black: player('b'),
    createdAt: 0,
    ...options,
  });
}

// Plays moves for alternating colours, one second apart from `start`. Returns the last result.
function play(session, moves, start = 1000) {
  let result;
  moves.forEach((uci, index) => {
    const color = session.turn;
    result = session.move(color, uci, session.moves.length, start + index * 1000);
    assert.ok(result.ok, `${uci} rejected: ${result.message}`);
  });
  return result;
}

const endOf = (result) => result.events.find((event) => event.type === 'end');

describe('moves', () => {
  test("fool's mate ends 0-1 by checkmate", () => {
    const session = newGame();
    const result = play(session, ['f2f3', 'e7e5', 'g2g4', 'd8h4']);
    assert.equal(endOf(result).result, '0-1');
    assert.equal(endOf(result).termination, 'checkmate');
    assert.equal(session.status, 'ended');
    assert.equal(result.events[0].san, 'Qh4#');
  });

  test('out-of-turn, stale and illegal moves are rejected', () => {
    const session = newGame();
    assert.equal(session.move('black', 'e7e5', 0, 100).ok, false);
    assert.equal(session.move('white', 'e2e4', 1, 100).code, 'STALE');
    assert.equal(session.move('white', 'e2e5', 0, 100).code, 'ILLEGAL');
    assert.equal(session.moves.length, 0);
    assert.equal(session.move('white', 'e2e4', 0, 100).ok, true);
  });

  test('castling is stored king-takes-rook', () => {
    const session = newGame();
    play(session, ['e2e4', 'e7e5', 'g1f3', 'b8c6', 'f1c4', 'g8f6']);
    const result = session.move('white', 'e1g1', 6, 9000);
    assert.equal(result.events[0].uci, 'e1h1');
    assert.equal(result.events[0].san, 'O-O');
  });
});

describe('clocks', () => {
  test('clocks start after both first moves and add the increment', () => {
    const session = newGame({ tc: { base: 60, inc: 2 } });
    session.move('white', 'e2e4', 0, 10_000);
    session.move('black', 'e7e5', 1, 20_000);
    assert.deepEqual(session.clock, { white: 60_000, black: 60_000 });
    session.move('white', 'g1f3', 2, 25_000);
    assert.equal(session.clock.white, 60_000 - 5_000 + 2_000);
    assert.equal(session.timeLeft('black', 26_000), 59_000);
  });

  test('flag is a loss', () => {
    const session = newGame();
    play(session, ['e2e4', 'e7e5']);
    assert.equal(session.nextTimerAt(), 2000 + 60_000);
    assert.deepEqual(session.flagCheck(61_000), []);
    const [end] = session.flagCheck(62_000);
    assert.equal(end.result, '0-1');
    assert.equal(end.termination, 'timeout');
    assert.equal(session.clock.white, 0);
  });

  test('a move after the flag ends the game instead', () => {
    const session = newGame();
    play(session, ['e2e4', 'e7e5']);
    const result = session.move('white', 'g1f3', 2, 70_000);
    assert.equal(result.ok, false);
    assert.equal(endOf(result).termination, 'timeout');
  });

  test('flag against a lone king is a draw', () => {
    // Black has only the king, so White's flag can't lose.
    const session = newGame({ variant: 'standard', initialFen: '4k3/8/8/8/8/8/4P3/4K3 w - - 0 1' });
    play(session, ['e1d1', 'e8d8']);
    const [end] = session.flagCheck(100_000);
    assert.equal(end.result, '1/2-1/2');
    assert.equal(end.termination, 'timeoutVsInsufficient');
  });
});

describe('draws', () => {
  test('threefold repetition', () => {
    const session = newGame();
    const shuffle = ['g1f3', 'g8f6', 'f3g1', 'f6g8'];
    const result = play(session, [...shuffle, ...shuffle]);
    assert.equal(endOf(result).termination, 'repetition');
  });

  test('fifty-move rule', () => {
    const session = newGame({ initialFen: '4k3/8/8/8/8/8/8/R3K3 w - - 98 80' });
    const result = play(session, ['a1a2', 'e8d8']);
    assert.equal(endOf(result).termination, 'fiftyMove');
  });

  test('offer limit, decline by moving, and accept', () => {
    const session = newGame();
    assert.equal(session.offerDraw('white', 0).ok, false); // before both moved
    play(session, ['e2e4', 'e7e5']);

    for (let i = 0; i < MAX_DRAW_OFFERS; i++) {
      assert.equal(session.offerDraw('white', 3000).ok, true);
      assert.equal(session.offerDraw('white', 3000).ok, false); // already pending
      assert.equal(session.respondDraw('black', false, 3000).ok, true);
    }
    assert.match(session.offerDraw('white', 3000).message, /No draw offers left/);
    assert.equal(session.offerDraw('black', 3000).ok, true); // Black's offers are counted separately
  });

  test('moving declines the opponent offer; accepting draws', () => {
    const session = newGame();
    play(session, ['e2e4', 'e7e5']);
    session.offerDraw('black', 3000);
    session.move('white', 'g1f3', 2, 4000);
    assert.equal(session.drawOffer, null);

    session.offerDraw('white', 5000);
    const result = session.respondDraw('black', true, 6000);
    assert.equal(endOf(result).result, '1/2-1/2');
    assert.equal(endOf(result).termination, 'agreement');
  });

  test('offering while the opponent offer is pending accepts it', () => {
    const session = newGame();
    play(session, ['e2e4', 'e7e5']);
    session.offerDraw('white', 3000);
    assert.equal(endOf(session.offerDraw('black', 3000)).termination, 'agreement');
  });
});

describe('abort, resign and claims', () => {
  test('White not moving in time aborts', () => {
    const session = newGame();
    assert.equal(session.nextTimerAt(), FIRST_MOVE_MS);
    assert.deepEqual(session.flagCheck(FIRST_MOVE_MS - 1), []);
    const [end] = session.flagCheck(FIRST_MOVE_MS);
    assert.equal(end.result, null);
    assert.equal(end.termination, 'abort');
  });

  test('Black gets 30 s after White first move', () => {
    const session = newGame();
    session.move('white', 'e2e4', 0, 20_000);
    assert.equal(session.nextTimerAt(), 20_000 + FIRST_MOVE_MS);
    assert.deepEqual(session.flagCheck(40_000), []);
    assert.equal(session.flagCheck(50_000)[0].termination, 'abort');
  });

  test('abort only before both have moved; resign only after', () => {
    const session = newGame();
    session.move('white', 'e2e4', 0, 1000);
    assert.equal(session.resign('white', 1000).ok, false);
    session.move('black', 'e7e5', 1, 2000);
    assert.equal(session.abort('black', 3000).ok, false);
    const result = session.resign('black', 3000);
    assert.equal(endOf(result).result, '1-0');
    assert.equal(session.move('white', 'g1f3', 2, 4000).ok, false);
  });

  test('claims end the game as abandoned', () => {
    const session = newGame();
    play(session, ['e2e4', 'e7e5']);
    const result = session.claimVictory('black', 5000);
    assert.equal(endOf(result).result, '0-1');
    assert.equal(endOf(result).termination, 'abandoned');
  });
});

describe('rematch', () => {
  test('offer then accept, or offer from both sides', () => {
    const session = newGame();
    assert.equal(session.offerRematch('white').ok, false); // still playing
    session.abort('white', 0);
    assert.equal(session.offerRematch('white').events[0].type, 'rematchOffer');
    assert.equal(session.respondRematch('black', true).rematch, true);

    session.offerRematch('black');
    assert.equal(session.offerRematch('white').rematch, true);
  });
});

describe('Chess960 and restore', () => {
  test('king-to-rook castling', () => {
    const session = newGame({ variant: 'chess960', initialFen: 'rk5r/pppppppp/8/8/8/8/PPPPPPPP/RK5R w KQkq - 0 1', category: 'chess960' });
    play(session, ['b2b3', 'b7b6']);
    assert.equal(session.move('white', 'b1d1', 2, 5000).ok, false); // two-square king move isn't castling here
    const result = session.move('white', 'b1h1', 2, 5000);
    assert.equal(result.events[0].san, 'O-O');
  });

  test('restore replays moves and restarts the clock at now', () => {
    const session = GameSession.restore(
      {
        id: 'restored',
        tc: { base: 180, inc: 2 },
        category: 'blitz',
        population: 'users',
        white: player('w'),
        black: player('b'),
        moves: ['e2e4', 'e7e5', 'g1f3'],
        clock: { white: 170_000, black: 175_000 },
      },
      500_000
    );
    assert.equal(session.turn, 'black');
    assert.equal(session.firstMoveDeadline, null);
    assert.equal(session.timeLeft('black', 510_000), 165_000);
    assert.equal(session.snapshot(510_000).moves[2].san, 'Nf3');
    assert.throws(() => GameSession.restore({ id: 'bad', tc: { base: 60, inc: 0 }, white: player('w'), black: player('b'), moves: ['e2e5'], clock: { white: 1, black: 1 } }, 0));
  });
});
