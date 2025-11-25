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
