// Thin SQLite layer.
// Two tables:
//   - leads:  one row per phone, updated on each interaction
//   - events: append-only log of everything that happens (inbound, classify,
//             outbound, notify). Makes audits + A/B tests trivial later.

import Database from 'better-sqlite3';
import path from 'node:path';
import fs from 'node:fs';

const SCHEMA = `
  CREATE TABLE IF NOT EXISTS leads (
    phone          TEXT PRIMARY KEY,
    first_name     TEXT,
    intent         TEXT,
    confidence     REAL,
    first_seen_at  INTEGER NOT NULL,
    last_seen_at   INTEGER NOT NULL,
    touchpoints    INTEGER NOT NULL DEFAULT 1
  );

  CREATE TABLE IF NOT EXISTS events (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    phone           TEXT NOT NULL,
    event_type      TEXT NOT NULL,       -- inbound | classified | outbound | notified | skipped
    message_sid     TEXT,                -- Twilio SID, dedup key for inbound
    payload_json    TEXT,
    created_at      INTEGER NOT NULL
  );

  CREATE UNIQUE INDEX IF NOT EXISTS idx_events_sid
    ON events (message_sid) WHERE message_sid IS NOT NULL;

  CREATE INDEX IF NOT EXISTS idx_events_phone_time
    ON events (phone, created_at DESC);
`;

export function openStore(databasePath) {
  fs.mkdirSync(path.dirname(databasePath), { recursive: true });
  const db = new Database(databasePath);
  db.pragma('journal_mode = WAL');
  db.exec(SCHEMA);

  const upsertLead = db.prepare(`
    INSERT INTO leads (phone, first_name, intent, confidence, first_seen_at, last_seen_at, touchpoints)
    VALUES (@phone, @firstName, @intent, @confidence, @now, @now, 1)
    ON CONFLICT(phone) DO UPDATE SET
      first_name   = COALESCE(excluded.first_name, leads.first_name),
      intent       = excluded.intent,
      confidence   = excluded.confidence,
      last_seen_at = excluded.last_seen_at,
      touchpoints  = leads.touchpoints + 1
  `);

  const insertEvent = db.prepare(`
    INSERT OR IGNORE INTO events (phone, event_type, message_sid, payload_json, created_at)
    VALUES (@phone, @eventType, @messageSid, @payloadJson, @createdAt)
  `);

  const alreadyProcessed = db.prepare(`
    SELECT 1 FROM events WHERE message_sid = ? LIMIT 1
  `);

  return {
    _db: db,

    hasBeenProcessed(messageSid) {
      if (!messageSid) return false;
      return !!alreadyProcessed.get(messageSid);
    },

    upsertLead({ phone, firstName = null, intent, confidence }) {
      upsertLead.run({
        phone,
        firstName,
        intent,
        confidence,
        now: Date.now(),
      });
    },

    logEvent({ phone, eventType, messageSid = null, payload = {} }) {
      insertEvent.run({
        phone,
        eventType,
        messageSid,
        payloadJson: JSON.stringify(payload),
        createdAt: Date.now(),
      });
    },

    close() { db.close(); },
  };
}
