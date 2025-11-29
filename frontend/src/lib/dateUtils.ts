/**
 * Format date to EST timezone with 12-hour format
 * @param dateStr ISO date string
 * @returns Formatted string like "12/24/2025, 3:45 PM"
 */
export function formatDateEST(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleString('en-US', {
    timeZone: 'America/New_York',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
}

/**
 * Extract just the time portion in EST timezone from UTC timestamp
 * @param dateStr ISO date string (UTC)
 * @returns Formatted time like "3:45 PM"
 */
export function formatTimeEST(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleString('en-US', {
    timeZone: 'America/New_York',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
}

/**
 * Extract hours and minutes in EST timezone from UTC timestamp
 * @param dateStr ISO date string (UTC)
 * @returns Object with hours (string, 24-hour) and minutes (string)
 */
export function getESTTimeComponents(dateStr: string): { hours: string; minutes: string } {
  const date = new Date(dateStr);
  const timeStr = date.toLocaleString('en-US', {
    timeZone: 'America/New_York',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
  const [hours, minutes] = timeStr.split(':');
  return { hours, minutes };
}

/**
 * Extract date in EST timezone from UTC timestamp (as YYYY-MM-DD)
 * @param dateStr ISO date string (UTC)
 * @returns Date string like "2025-11-24"
 */
export function getESTDateString(dateStr: string): string {
  const date = new Date(dateStr);
  const dateOnlyStr = date.toLocaleString('en-US', {
    timeZone: 'America/New_York',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  // dateOnlyStr is in MM/DD/YYYY format, convert to YYYY-MM-DD
  const [month, day, year] = dateOnlyStr.split('/');
  return `${year}-${month}-${day}`;
}
