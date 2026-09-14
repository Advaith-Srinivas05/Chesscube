import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { isProvisional, rate, rateGame, RATING_MIN, RD_MAX, RD_MIN } from '../src/lib/glicko2.js';

const near = (actual, expected, tolerance, label) =>
  assert.ok(Math.abs(actual - expected) <= tolerance, `${label}: expected ${expected} ± ${tolerance}, got ${actual}`);

describe('glicko2', () => {
  test("Glickman's worked example", () => {
    const result = rate(
      { r: 1500, rd: 200, vol: 0.06 },
      [
        { r: 1400, rd: 30, score: 1 },
        { r: 1550, rd: 100, score: 0 },
        { r: 1700, rd: 300, score: 0 },
      ],
      0.5
    );
    near(result.r, 1464.06, 0.01, 'rating');
    near(result.rd, 151.52, 0.01, 'rd');
    near(result.vol, 0.05999, 0.0001, 'volatility');
  });

  test('no results leaves the player unchanged', () => {
    assert.deepEqual(rate({ r: 800, rd: 350, vol: 0.06 }, []), { r: 800, rd: 350, vol: 0.06 });
  });

  test('equal players drawing stay equal', () => {
    const player = { r: 1200, rd: 120, vol: 0.06 };
    const [a, b] = rateGame(player, player, 0.5);
    near(a.r, 1200, 1e-9, 'a');
    near(b.r, 1200, 1e-9, 'b');
    assert.ok(a.rd < player.rd);
  });

  test('the winner gains and the loser drops', () => {
    const [winner, loser] = rateGame({ r: 800, rd: 350, vol: 0.06 }, { r: 800, rd: 350, vol: 0.06 }, 1);
    assert.ok(winner.r > 800);
    assert.ok(loser.r < 800);
  });

  test('clamps hold', () => {
    const low = rate({ r: 110, rd: 350, vol: 0.06 }, [{ r: 3000, rd: 45, score: 0 }]);
    assert.ok(low.r >= RATING_MIN);

    // A low volatility lets RD fall below the floor without the clamp.
    let settled = { r: 1500, rd: 60, vol: 0.001 };
    for (let i = 0; i < 200; i++) settled = { ...rate(settled, [{ r: 1500, rd: 45, score: 0.5 }]), vol: 0.001 };
    assert.equal(settled.rd, RD_MIN);

    const fresh = rate({ r: 1500, rd: 350, vol: 0.2 }, [{ r: 1500, rd: 350, score: 1 }]);
    assert.ok(fresh.rd <= RD_MAX);
  });

  test('provisional above RD 110', () => {
    assert.equal(isProvisional(350), true);
    assert.equal(isProvisional(110), false);
  });
});
