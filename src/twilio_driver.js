// Thin wrapper around the Twilio SDK with a mock driver for demo / tests.
// The real driver validates webhook signatures so we don't accept spoofed
// inbound traffic.

import twilio from 'twilio';

export function realDriver({ accountSid, authToken, whatsappFrom }) {
  if (!accountSid || !authToken) {
    throw new Error('Twilio accountSid + authToken required for real driver.');
  }
  const client = twilio(accountSid, authToken);
  return {
    async sendWhatsApp({ to, body }) {
      const msg = await client.messages.create({
        from: whatsappFrom,
        to: `whatsapp:${to}`,
        body,
      });
      return { sid: msg.sid };
    },
    validateSignature({ signature, url, params }) {
      return twilio.validateRequest(authToken, signature, url, params);
    },
  };
}

/** In-memory driver for tests + `npm run demo`. Records every outbound. */
export function mockDriver() {
  const sent = [];
  return {
    sent,
    async sendWhatsApp({ to, body }) {
      const sid = `MOCK-${Date.now()}-${sent.length}`;
      sent.push({ to, body, sid });
      return { sid };
    },
    validateSignature() { return true; },  // no-op in demo mode
  };
}
