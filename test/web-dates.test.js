import test from 'node:test';
import assert from 'node:assert/strict';
import { dateInput, deadlineFromInput } from '../web/dates.js';

test('date controls show the Shanghai calendar day at UTC and local midnight boundaries', () => {
  assert.equal(dateInput('2026-11-03T23:00:00.000Z'), '2026-11-04');
  assert.equal(dateInput('2026-11-04T15:59:59.999Z'), '2026-11-04');
  assert.equal(dateInput('2026-11-04T16:00:00.000Z'), '2026-11-05');
  assert.equal(dateInput(null), '');
});

test('unchanged deadline dates preserve the exact stored time and precision', () => {
  for (const original of ['2026-11-03T23:00:00.000Z', '2026-11-04T02:30:12.456Z', '2026-11-04T15:59:59.999Z', '2026-11-04T09:00:00+08:00']) {
    assert.equal(deadlineFromInput(dateInput(original), original), original);
  }
  assert.equal(deadlineFromInput('', null), null);
});

test('explicit deadline edits use Shanghai day end, and clearing removes the deadline', () => {
  assert.equal(deadlineFromInput('2026-11-05', '2026-11-03T23:00:00.000Z'), '2026-11-05T15:59:59.000Z');
  assert.equal(deadlineFromInput('2026-11-05'), '2026-11-05T15:59:59.000Z');
  assert.equal(deadlineFromInput('', '2026-11-03T23:00:00.000Z'), null);
  assert.throws(() => deadlineFromInput('2026-02-30'), RangeError);
});
