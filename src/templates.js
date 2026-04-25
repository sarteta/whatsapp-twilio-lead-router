// Intent-specific auto-reply templates.
// Kept as plain functions so a broker can edit the wording without touching
// classifier logic. Each template returns a string; quiet-hours wrapping is
// applied by the caller.

export const TEMPLATES = {
  buyer: ({ firstName }) => (
    `Hi ${firstName || 'there'} -- thanks for reaching out about a property. ` +
    `To get you to the right agent fast, could you share: ` +
    `(1) the area you're focused on, (2) your target price range, and ` +
    `(3) whether you're pre-approved? An agent will follow up within the hour.`
  ),

  seller: ({ firstName }) => (
    `Hi ${firstName || 'there'} -- happy to help you explore selling. ` +
    `Could you share the property address and your rough timeline? ` +
    `We'll get a no-obligation valuation back to you within 24 hours.`
  ),

  investor: ({ firstName }) => (
    `Hi ${firstName || 'there'} -- passing you to our investor-focused agent. ` +
    `To speed things up, share your criteria (market, price ceiling, strategy). ` +
    `We'll match you against our off-market list today.`
  ),

  nurture: ({ firstName }) => (
    `Hi ${firstName || 'there'} -- got it, thanks. ` +
    `An agent will review and reach out. If it's urgent, reply URGENT and we'll prioritize.`
  ),

  stop: () => (
    `You've been unsubscribed. Reply START to opt back in. No further messages will be sent.`
  ),

  help: () => (
    `Msg&Data rates may apply. Reply STOP to unsubscribe, HELP for help. ` +
    `For support contact us via the website.`
  ),

  spam: () => null,   // explicitly no reply
};

const QUIET_PREFIX = (
  `We received your message after hours -- we'll respond first thing in the morning. `
);

export function buildReply({ intent, firstName, isQuietHours }) {
  const fn = TEMPLATES[intent];
  if (!fn) return null;
  const body = fn({ firstName });
  if (body === null) return null;
  if (isQuietHours && intent !== 'stop' && intent !== 'help') {
    return `${QUIET_PREFIX}\n\n${body}`;
  }
  return body;
}
