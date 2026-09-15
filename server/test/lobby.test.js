import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { findQuickMatch } from '../src/realtime/lobby.js';

const seek = (id, fields = {}) => ({
  id,
  owner: { id: `owner-${id}` },
  population: 'users',
  variant: 'standard',
  tc: { base: 180, inc: 2 },
  rated: true,
  createdAt: 0,
  ...fields,
});
const request = { identityId: 'me', population: 'users', base: 180, inc: 2, rated: true };

describe('quick pairing', () => {
  test('joins the oldest open game with the same settings', () => {
    const seeks = [seek('newer', { createdAt: 20 }), seek('older', { createdAt: 10 })];
    assert.equal(findQuickMatch(seeks, request).id, 'older');
  });

  test('ignores other time controls, modes, variants, populations and your own game', () => {
    const seeks = [
      seek('time', { tc: { base: 180, inc: 0 } }),
      seek('casual', { rated: false }),
      seek('960', { variant: 'chess960' }),
      seek('guest', { population: 'guests' }),
      seek('mine', { owner: { id: 'me' } }),
    ];
    assert.equal(findQuickMatch(seeks, request), null);
  });
});
