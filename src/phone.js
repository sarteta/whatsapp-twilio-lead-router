// Phone normalization helpers.
// We normalize EVERYTHING to E.164 before storing or comparing. Saves a class
// of "same lead looks like two leads" bugs downstream.

export function toE164(raw, defaultCountry = 'US') {
  if (!raw) return null;
  const trimmed = String(raw).trim();

  // Already E.164? (plus sign + 8-15 digits)
  if (/^\+\d{8,15}$/.test(trimmed)) return trimmed;

  // Strip non-digits; keep leading + if present
  const digits = trimmed.replace(/\D/g, '');
  if (!digits) return null;

  if (defaultCountry === 'US') {
    if (digits.length === 10) return `+1${digits}`;
    if (digits.length === 11 && digits.startsWith('1')) return `+${digits}`;
  }
  // Caller should pass defaultCountry for non-US; fall back to assuming user
  // included country code without the +.
  return `+${digits}`;
}

// Thin helper for WhatsApp's `whatsapp:+E164` protocol prefix used by Twilio.
export function toWhatsApp(e164) {
  if (!e164) return null;
  if (e164.startsWith('whatsapp:')) return e164;
  return `whatsapp:${e164}`;
}
