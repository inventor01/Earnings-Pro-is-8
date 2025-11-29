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

/**
 * Get current date in EST timezone as YYYY-MM-DD
 * @returns Current date in EST as YYYY-MM-DD string
 */
export function getTodayEST(): string {
  return getESTDateString(new Date().toISOString());
}

/**
 * Add/subtract days from a date in EST timezone
 * @param dateStr Date in YYYY-MM-DD format
 * @param daysOffset Number of days to add (positive) or subtract (negative)
 * @returns New date in YYYY-MM-DD format
 */
export function addDaysEST(dateStr: string, daysOffset: number): string {
  // Parse the date string as a naive local date
  const [year, month, day] = dateStr.split('-').map(Number);
  // Create a date object (will be interpreted as local date)
  const date = new Date(year, month - 1, day);
  // Add offset
  date.setDate(date.getDate() + daysOffset);
  // Convert back to YYYY-MM-DD
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}
