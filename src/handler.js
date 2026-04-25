// Core inbound handler -- separated from express so we can unit-test it
// cleanly without booting a server or mocking HTTP.

import { classify } from './classifier.js';
import { buildReply } from './templates.js';
import { isQuietHours } from './quiet_hours.js';
import { toE164 } from './phone.js';

const HIGH_INTENT = new Set(['buyer', 'seller', 'investor']);

export async function handleInbound({
  from,
  body,
  messageSid = null,
  profileName = null,
  store,
  twilio,
  config = {},
  llmDriver = null,
  notifyWebhook = null,
}) {
  const phone = toE164(from);
  if (!phone) {
    return { status: 'rejected', reason: 'invalid-phone' };
  }

  // Idempotency: Twilio retries webhooks on 5xx / timeouts. Same MessageSid
  // arriving twice should NOT trigger two auto-replies.
  if (messageSid && store.hasBeenProcessed(messageSid)) {
    return { status: 'skipped', reason: 'already-processed', phone, messageSid };
  }

  store.logEvent({
    phone,
    eventType: 'inbound',
    messageSid,
    payload: { body, profileName },
  });

  const classification = await classify(body, llmDriver);
  store.logEvent({
    phone,
    eventType: 'classified',
    payload: classification,
  });
  store.upsertLead({
    phone,
    firstName: profileName ? profileName.split(' ')[0] : null,
    intent: classification.intent,
    confidence: classification.confidence,
  });

  const quiet = isQuietHours({
    timezone: config.timezone,
    startHour: config.quietStart,
    endHour: config.quietEnd,
  });

  const replyBody = buildReply({
    intent: classification.intent,
    firstName: profileName ? profileName.split(' ')[0] : null,
    isQuietHours: quiet,
  });

  let outboundSid = null;
  if (replyBody) {
    const out = await twilio.sendWhatsApp({ to: phone, body: replyBody });
    outboundSid = out.sid;
    store.logEvent({
      phone,
      eventType: 'outbound',
      payload: { body: replyBody, sid: out.sid, channel: 'whatsapp' },
    });
  } else {
    store.logEvent({ phone, eventType: 'skipped', payload: { reason: 'no-template' } });
  }

  // Fire notify webhook only for high-intent leads (and only if configured).
  if (notifyWebhook && HIGH_INTENT.has(classification.intent)) {
    try {
      await fetch(notifyWebhook, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone,
          intent: classification.intent,
          confidence: classification.confidence,
          inbound: body,
          profileName,
          at: new Date().toISOString(),
        }),
      });
      store.logEvent({ phone, eventType: 'notified', payload: { url: notifyWebhook } });
    } catch (err) {
      store.logEvent({
        phone,
        eventType: 'notify-failed',
        payload: { error: String(err) },
      });
    }
  }

  return {
    status: 'handled',
    phone,
    intent: classification.intent,
    replySent: !!replyBody,
    outboundSid,
  };
}
