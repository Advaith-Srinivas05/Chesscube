import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { createTokenBucket } from '../src/realtime/rateLimit.js';

describe('socket token bucket', () => {
  it('allows a burst, then refuses until tokens refill', () => {
    let time = 0;
    const take = createTokenBucket({ rate: 20, burst: 40, now: () => time });
    for (let i = 0; i < 40; i++) assert.equal(take(), true, `event ${i}`);
    assert.equal(take(), false);
    time += 50; // one token at 20/s
    assert.equal(take(), true);
    assert.equal(take(), false);
  });

  it('keeps up with a steady 20 events per second indefinitely', () => {
    let time = 0;
    const take = createTokenBucket({ rate: 20, burst: 40, now: () => time });
    for (let i = 0; i < 2000; i++) {
      time += 50;
      assert.equal(take(), true);
    }
  });

  it('never stores more than the burst', () => {
    let time = 0;
    const take = createTokenBucket({ rate: 20, burst: 40, now: () => time });
    time += 60_000;
    let allowed = 0;
    while (take()) allowed++;
    assert.equal(allowed, 40);
  });
});
