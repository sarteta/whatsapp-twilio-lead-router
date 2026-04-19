import test from 'node:test';
import assert from 'node:assert/strict';
import { isQuietHours } from '../src/quiet_hours.js';

// Use UTC timezone + explicit dates to make these deterministic.
test('before quiet hours = not quiet (window wraps midnight)', () => {
  assert.equal(isQuietHours({
    now: new Date('2026-04-20T18:00:00Z'),   // 18:00 UTC
    timezone: 'UTC',
    startHour: 21,
    endHour: 9,
  }), false);
});

test('at start hour = quiet', () => {
  assert.equal(isQuietHours({
    now: new Date('2026-04-20T21:00:00Z'),
    timezone: 'UTC',
    startHour: 21,
    endHour: 9,
  }), true);
});

test('after midnight but before end = quiet', () => {
  assert.equal(isQuietHours({
    now: new Date('2026-04-20T03:00:00Z'),
    timezone: 'UTC',
    startHour: 21,
    endHour: 9,
  }), true);
});

test('at end hour = no longer quiet', () => {
  assert.equal(isQuietHours({
    now: new Date('2026-04-20T09:00:00Z'),
    timezone: 'UTC',
    startHour: 21,
    endHour: 9,
  }), false);
});

test('non-wrapping window', () => {
  assert.equal(isQuietHours({
    now: new Date('2026-04-20T13:00:00Z'),
    timezone: 'UTC',
    startHour: 10,
    endHour: 14,
  }), true);
  assert.equal(isQuietHours({
    now: new Date('2026-04-20T14:00:00Z'),
    timezone: 'UTC',
    startHour: 10,
    endHour: 14,
  }), false);
});
