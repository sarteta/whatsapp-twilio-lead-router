# Architecture notes

## Why rule-first, LLM-fallback

Two reasons:

1. **Cost.** An LLM call is ~200ms + 1/10th of a cent. A regex match is 5µs
   and free. For real-estate SMS traffic (very patterned -- 90% hits one of
   ~15 keywords), the LLM adds cost but almost never changes the outcome.
2. **Explainability.** When an agent asks "why did the bot tag this lead as
   seller?" the answer `"rule: /\b(sell(ing)? (my )?(home|house))\b/"` is
   defensible. "The LLM said so" isn't.

The classifier is composed such that:

```js
classify(text)
  → classifyByRules(text)      // synchronous, free
    ├─ intent found → return
    └─ intent null  → classifyByLLM(text, driver)
                        ├─ driver disabled → return nurture (safe default)
                        ├─ valid label     → return
                        └─ garbage         → return nurture
```

`nurture` is the always-safe default because:
- It sends a polite acknowledgement (doesn't burn the lead)
- It doesn't ping the high-intent webhook (doesn't burn agent attention)
- It still creates the lead record so a human can review

## Idempotency (MessageSid dedup)

Twilio retries webhook delivery if we return 5xx or time out. That means the
same inbound can hit us 2-3 times in ~30 seconds.

Naïve: we'd send 2-3 auto-replies and double-insert the lead.

Fix: every `events` row is INSERTed with the Twilio `MessageSid` as a UNIQUE
index column, and the handler checks `store.hasBeenProcessed(messageSid)`
before doing anything. If true, we return early -- status `skipped`.

## Why SQLite instead of Postgres

The target deployment is a small brokerage running this on a single VPS or
Railway. SQLite means:

- Zero setup, zero ops.
- WAL mode gives us safe concurrent reads during writes.
- Single file backup (`data/leads.sqlite` → S3 nightly).

If traffic ever grows past ~100k leads / day, swap in Postgres: only
`src/store.js` needs to change.

## Template editing workflow

Templates live in `src/templates.js` as pure functions. Brokers can edit
them without understanding the classifier, and unit tests in
`tests/handler.test.js` verify that the OUTBOUND body actually renders.

Future: templates move to DB-backed records with an admin UI, so non-devs
can A/B test wording.

## STOP / HELP compliance

Twilio's Messaging Policy (and US carrier rules) require every inbound
`STOP` to immediately halt outbound + send a confirmation. Every `HELP`
must return a standard informational reply.

Both are baked into the classifier at the top of `RULES` so nothing else
can capture them first. The `stop` intent template suppresses the drip
scheduler (see roadmap) -- once implemented, STOP → drip.cancel(phone).
