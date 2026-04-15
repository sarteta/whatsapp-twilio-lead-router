// `npm run demo` — fires 8 synthetic SMS payloads through the pipeline
// using the mock Twilio driver. Zero network calls, prints each step.

import { openStore } from '../src/store.js';
import { mockDriver } from '../src/twilio_driver.js';
import { handleInbound } from '../src/handler.js';

const DEMO_DB = './data/leads.demo.sqlite';

const INBOUND_SAMPLES = [
  { from: '+15551234567', body: 'Hi, looking to buy a 3-bed in Austin under $500k. Pre-approved.', profileName: 'Casey Nguyen' },
  { from: '+15552222222', body: 'I want to sell my house on 123 Maple Ave. Cash offer?', profileName: 'Dana Brooks' },
  { from: '+15553333333', body: 'Investor here, looking for off-market wholesale deals in Denver.', profileName: 'Jules Park' },
  { from: '+15554444444', body: 'Hey thanks', profileName: 'Ambiguous Person' },
  { from: '+15555555555', body: 'STOP', profileName: 'Opt Out' },
  { from: '+15556666666', body: 'HELP', profileName: 'Help Seeker' },
  { from: '+15557777777', body: 'https://spammy.example/win-a-prize', profileName: 'Spammer' },
  { from: '+15558888888', body: 'Is 456 Oak St still available? Can I schedule a tour?', profileName: 'Robin Alvarez' },
];

async function main() {
  // Fresh store per run
  try { (await import('node:fs')).unlinkSync(DEMO_DB); } catch {}
  const store = openStore(DEMO_DB);
  const twilio = mockDriver();
  const config = {
    timezone: 'America/New_York',
    quietStart: 21,
    quietEnd: 9,
  };

  console.log('--- demo mode (no network calls) ---\n');
  for (const [idx, msg] of INBOUND_SAMPLES.entries()) {
    const result = await handleInbound({
      ...msg,
      messageSid: `DEMO-${idx}`,
      store,
      twilio,
      config,
    });
    console.log(`[${idx + 1}] ${msg.from}  "${msg.body}"`);
    console.log(`    → intent=${result.intent}  reply=${result.replySent ? 'YES' : '(none)'}`);
    if (result.replySent) {
      const last = twilio.sent[twilio.sent.length - 1];
      console.log(`    ↪ ${last.body.split('\n')[0].slice(0, 80)}${last.body.length > 80 ? '…' : ''}`);
    }
    console.log();
  }

  console.log(`--- summary: ${twilio.sent.length} outbound WhatsApp messages sent ---`);
  store.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
