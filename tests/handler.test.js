import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { openStore } from '../src/store.js';
import { mockDriver } from '../src/twilio_driver.js';
import { handleInbound } from '../src/handler.js';

function tmpDb() {
  return path.join(os.tmpdir(), `leads-${Date.now()}-${Math.random().toString(36).slice(2)}.sqlite`);
}

test('buyer inbound → classified + WhatsApp reply sent', async () => {
  const dbPath = tmpDb();
  const store = openStore(dbPath);
  const twilio = mockDriver();
  const result = await handleInbound({
    from: '+15551234567',
    body: 'Looking to buy a 3-bed, pre-approved',
    messageSid: 'SM-test-1',
    profileName: 'Casey Nguyen',
    store,
    twilio,
    config: { timezone: 'UTC', quietStart: 21, quietEnd: 9 },
  });
  assert.equal(result.status, 'handled');
  assert.equal(result.intent, 'buyer');
  assert.equal(result.replySent, true);
  assert.equal(twilio.sent.length, 1);
  assert.match(twilio.sent[0].body, /Casey/);
  store.close();
  fs.unlinkSync(dbPath);
});

test('spam inbound → no reply', async () => {
  const dbPath = tmpDb();
  const store = openStore(dbPath);
  const twilio = mockDriver();
  const result = await handleInbound({
    from: '+15551234567',
    body: 'https://spammy.example/',
    messageSid: 'SM-test-2',
    store,
    twilio,
    config: { timezone: 'UTC', quietStart: 21, quietEnd: 9 },
  });
  assert.equal(result.intent, 'spam');
  assert.equal(result.replySent, false);
  assert.equal(twilio.sent.length, 0);
  store.close();
  fs.unlinkSync(dbPath);
});

test('duplicate MessageSid is skipped', async () => {
  const dbPath = tmpDb();
  const store = openStore(dbPath);
  const twilio = mockDriver();
  await handleInbound({
    from: '+15551234567',
    body: 'Looking to buy',
    messageSid: 'SM-same',
    store, twilio,
    config: { timezone: 'UTC', quietStart: 21, quietEnd: 9 },
  });
  const second = await handleInbound({
    from: '+15551234567',
    body: 'Looking to buy',
    messageSid: 'SM-same',
    store, twilio,
    config: { timezone: 'UTC', quietStart: 21, quietEnd: 9 },
  });
  assert.equal(second.status, 'skipped');
  assert.equal(twilio.sent.length, 1);
  store.close();
  fs.unlinkSync(dbPath);
});

test('high-intent lead fires notify webhook', async () => {
  const dbPath = tmpDb();
  const store = openStore(dbPath);
  const twilio = mockDriver();

  const originalFetch = globalThis.fetch;
  const calls = [];
  globalThis.fetch = async (url, init) => {
    calls.push({ url, body: init?.body });
    return { ok: true };
  };

  try {
    await handleInbound({
      from: '+15551234567',
      body: 'Selling my house in Austin, cash offer?',
      messageSid: 'SM-seller',
      store, twilio,
      config: { timezone: 'UTC', quietStart: 21, quietEnd: 9 },
      notifyWebhook: 'https://hooks.example/slack',
    });
  } finally {
    globalThis.fetch = originalFetch;
  }
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, 'https://hooks.example/slack');
  assert.match(calls[0].body, /seller/);
  store.close();
  fs.unlinkSync(dbPath);
});

test('nurture lead does NOT fire notify webhook', async () => {
  const dbPath = tmpDb();
  const store = openStore(dbPath);
  const twilio = mockDriver();

  const originalFetch = globalThis.fetch;
  const calls = [];
  globalThis.fetch = async (url) => { calls.push(url); return { ok: true }; };

  try {
    await handleInbound({
      from: '+15551234567',
      body: 'thanks got it',
      messageSid: 'SM-nurture',
      store, twilio,
      config: { timezone: 'UTC', quietStart: 21, quietEnd: 9 },
      notifyWebhook: 'https://hooks.example/slack',
    });
  } finally {
    globalThis.fetch = originalFetch;
  }
  assert.equal(calls.length, 0);
  store.close();
  fs.unlinkSync(dbPath);
});
