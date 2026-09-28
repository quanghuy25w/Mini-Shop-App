export const TIMEZONE_VN = 'Asia/Ho_Chi_Minh';

/**
 * Returns business date formatted as YYYY-MM-DD in Asia/Ho_Chi_Minh timezone.
 * @param {Date|string|number} date
 * @returns {string} YYYY-MM-DD
 */
export function getBusinessDate(date = new Date()) {
  const d = typeof date === 'string' || typeof date === 'number' ? new Date(date) : date;
  if (isNaN(d.getTime())) {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: TIMEZONE_VN,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    }).format(new Date());
  }
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: TIMEZONE_VN,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(d);
}

/**
 * Returns current minutes from midnight (0..1439) in Asia/Ho_Chi_Minh timezone.
 * @param {Date|string|number} date
 * @returns {number}
 */
export function getVnMinutes(date = new Date()) {
  const d = typeof date === 'string' || typeof date === 'number' ? new Date(date) : date;
  const target = isNaN(d.getTime()) ? new Date() : d;
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: TIMEZONE_VN,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23'
  }).formatToParts(target);
  const h = Number(parts.find(p => p.type === 'hour')?.value ?? 0);
  const m = Number(parts.find(p => p.type === 'minute')?.value ?? 0);
  return h * 60 + m;
}

/**
 * Returns object with VN date/time components.
 * @param {Date|string|number} date
 * @returns {{ year: string, month: string, day: string, hour: string, minute: string, second: string }}
 */
export function getVnParts(date = new Date()) {
  const d = typeof date === 'string' || typeof date === 'number' ? new Date(date) : date;
  const target = isNaN(d.getTime()) ? new Date() : d;
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: TIMEZONE_VN,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23'
  }).formatToParts(target);

  const get = (type) => parts.find(p => p.type === type)?.value || '';
  return {
    year: get('year'),
    month: get('month'),
    day: get('day'),
    hour: get('hour'),
    minute: get('minute'),
    second: get('second')
  };
}
