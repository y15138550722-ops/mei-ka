const BEIJING_TIMEZONE = 'Asia/Shanghai';

const BEIJING_TIMESTAMP_FORMATTER = new Intl.DateTimeFormat('en-CA', {
  timeZone: BEIJING_TIMEZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hour12: false,
});

export const formatBeijingTimestamp = (value: Date | number | string = new Date()) => {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '';
  }

  const parts = Object.fromEntries(
    BEIJING_TIMESTAMP_FORMATTER.formatToParts(date).map((part) => [part.type, part.value]),
  );

  return `${parts.year}-${parts.month}-${parts.day} ${parts.hour}:${parts.minute}:${parts.second}`;
};

/** Stored timestamps without an offset represent Beijing wall-clock time. */
export const normalizeBeijingTimestamp = (value: string): string => {
  const normalized = String(value ?? '').trim().replace(/\//g, '-');
  const match = normalized.match(/^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2})(?::(\d{2})(\.\d{1,3})?)?(Z|[+-]\d{2}:?\d{2})?)?$/i);
  if (!match) return '';
  const [, year, month, day, hour = '00', minute = '00', second = '00', fraction = '', zone] = match;
  const date = new Date(`${year}-${month}-${day}T00:00:00Z`);
  if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== `${year}-${month}-${day}` || Number(hour) > 23 || Number(minute) > 59 || Number(second) > 59) return '';
  return formatBeijingTimestamp(`${year}-${month}-${day}T${hour}:${minute}:${second}${fraction}${zone || '+08:00'}`);
};
