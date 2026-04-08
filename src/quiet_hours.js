// Quiet-hours helper that respects the owner's timezone.
// Using Intl.DateTimeFormat with a timezone avoids the classic bug of
// checking UTC and accidentally muting replies during the day.

export function isQuietHours({
  now = new Date(),
  timezone = 'America/New_York',
  startHour = 21,
  endHour = 9,
}) {
  const fmt = new Intl.DateTimeFormat('en-US', {
    hour: '2-digit',
    hour12: false,
    timeZone: timezone,
  });
  // Intl returns "24" for midnight on some runtimes, normalize:
  const raw = fmt.format(now).padStart(2, '0');
  const hour = raw === '24' ? 0 : parseInt(raw, 10);

  // Window wraps past midnight (21 → 9) vs doesn't (9 → 17)
  if (startHour > endHour) {
    return hour >= startHour || hour < endHour;
  }
  return hour >= startHour && hour < endHour;
}
