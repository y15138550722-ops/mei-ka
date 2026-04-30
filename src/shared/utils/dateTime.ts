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
