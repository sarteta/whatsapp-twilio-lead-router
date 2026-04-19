import test from 'node:test';
import assert from 'node:assert/strict';
import { toE164, toWhatsApp } from '../src/phone.js';

test('already-E164 pass through', () => {
  assert.equal(toE164('+15551234567'), '+15551234567');
});

test('US 10-digit normalizes to E.164', () => {
  assert.equal(toE164('5551234567'), '+15551234567');
});

test('US 11-digit with leading 1 normalizes', () => {
  assert.equal(toE164('15551234567'), '+15551234567');
});

test('US formatted string normalizes', () => {
  assert.equal(toE164('(555) 123-4567'), '+15551234567');
});

test('empty/null safe', () => {
  assert.equal(toE164(''), null);
  assert.equal(toE164(null), null);
});

test('toWhatsApp prepends protocol', () => {
  assert.equal(toWhatsApp('+15551234567'), 'whatsapp:+15551234567');
});

test('toWhatsApp idempotent', () => {
  assert.equal(toWhatsApp('whatsapp:+15551234567'), 'whatsapp:+15551234567');
});
