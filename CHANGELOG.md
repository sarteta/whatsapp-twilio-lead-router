# Changelog

## [Unreleased]

## [0.1.0] -- 2026-04-20

First tagged release. This is the shape of the router I built for a real
estate client in Córdoba and generalized so the specifics aren't leaking.

### Added

- Inbound webhook handler for Twilio WhatsApp + SMS, normalized into a single
  `Lead` shape.
- Rule-based router (`data/rules.yml`) -- route by keyword, phone prefix, time
  window, or fallback.
- Agent pool with round-robin + off-hours handling.
- Outbound Twilio send with idempotency key (avoids double-send on webhook
  retries).
- Jest suite with fake Twilio client.

### Known gaps

- No persistent queue -- if the process dies mid-request the retry is on
  Twilio's side. Fine for the volume I was targeting; add Redis/SQS if
  you push through higher.
- No analytics beyond what Twilio's console already shows.
