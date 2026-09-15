import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { isLessonId, LESSON_IDS } from '../src/shared/lessonIds.js';

describe('lesson ids', () => {
  test('ids are unique, url-safe slugs', () => {
    assert.equal(new Set(LESSON_IDS).size, LESSON_IDS.length);
    for (const id of LESSON_IDS) assert.match(id, /^[a-z0-9]+(-[a-z0-9]+)*$/);
  });

  test('only listed lessons are accepted', () => {
    assert.equal(isLessonId('knight'), true);
    assert.equal(isLessonId('Knight'), false);
    assert.equal(isLessonId('__proto__'), false);
    assert.equal(isLessonId(undefined), false);
  });
});
