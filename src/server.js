// Express wrapper around the handler. Kept thin on purpose -- business
// logic lives in handler.js so it's unit-testable without HTTP.

import 'dotenv/config';
import express from 'express';
import { openStore } from './store.js';
import { realDriver, mockDriver } from './twilio_driver.js';
import { handleInbound } from './handler.js';

export function buildApp({
  store,
  twilioDriver,
  notifyWebhook,
  llmDriver = null,
  config,
}) {
  const app = express();
  app.use(express.urlencoded({ extended: false }));
  app.use(express.json());

  app.get('/health', (_req, res) => res.json({ ok: true }));

  app.post('/webhooks/sms', async (req, res) => {
    const signature = req.get('X-Twilio-Signature');
    const fullUrl = `${req.protocol}://${req.get('host')}${req.originalUrl}`;
    const valid = twilioDriver.validateSignature({
      signature,
      url: fullUrl,
      params: req.body,
    });
    if (!valid) {
      return res.status(403).send('invalid signature');
    }

    const result = await handleInbound({
      from: req.body.From,
      body: req.body.Body,
      messageSid: req.body.MessageSid,
      profileName: req.body.ProfileName,
      store,
      twilio: twilioDriver,
      config,
      llmDriver,
      notifyWebhook,
    });

    // Always 200 -- we logged, we own retries via MessageSid dedup.
    // Empty TwiML = "we handled it, don't auto-reply on your end".
    res.type('text/xml').send('<?xml version="1.0" encoding="UTF-8"?><Response></Response>');
    // eslint-disable-next-line no-console
    console.log(JSON.stringify({ level: 'info', event: 'sms-handled', ...result }));
  });

  return app;
}

function configFromEnv() {
  return {
    port: parseInt(process.env.PORT || '3000', 10),
    timezone: process.env.OWNER_TIMEZONE || 'America/New_York',
    quietStart: parseInt(process.env.QUIET_HOURS_START || '21', 10),
    quietEnd: parseInt(process.env.QUIET_HOURS_END || '9', 10),
  };
}

function driverFromEnv() {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  if (!sid || !token) {
    console.warn('[twilio] no credentials found -- running mock driver (demo mode)');
    return mockDriver();
  }
  return realDriver({
    accountSid: sid,
    authToken: token,
    whatsappFrom: process.env.TWILIO_WHATSAPP_FROM,
  });
}

// `node src/server.js` -- production entrypoint
const isMain = import.meta.url === `file://${process.argv[1].replace(/\\/g, '/')}`
            || import.meta.url === `file:///${process.argv[1].replace(/\\/g, '/')}`;
if (isMain) {
  const config = configFromEnv();
  const store = openStore(process.env.DATABASE_PATH || './data/leads.sqlite');
  const twilioDriver = driverFromEnv();
  const notifyWebhook = process.env.LEAD_NOTIFY_WEBHOOK || null;

  const app = buildApp({ store, twilioDriver, notifyWebhook, config });
  app.listen(config.port, () => {
    // eslint-disable-next-line no-console
    console.log(`lead-router listening on :${config.port} (tz=${config.timezone})`);
  });
}
