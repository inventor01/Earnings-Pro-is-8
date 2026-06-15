import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { Entry, parseServerDate } from './api';

// Columns are kept identical (and in the same order) to what the in-app CSV
// importer accepts, so an exported file round-trips cleanly back through Import.
const HEADER = [
  'date',
  'time',
  'type',
  'app',
  'amount',
  'distance_miles',
  'duration_minutes',
  'category',
  'note',
] as const;

function csvEscape(value: string): string {
  return /[",\n\r]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

// The importer/backend interprets the `date` + `time` columns as US/Eastern and
// converts them to UTC, so we must emit Eastern wall-clock values (NOT the
// device's local time) for an entry to round-trip back to the same instant
// regardless of the exporting device's timezone.
export function easternDateTime(d: Date): { date: string; time: string } {
  // en-CA formats as YYYY-MM-DD / HH:MM in 24h, which matches the importer.
  const date = d.toLocaleDateString('en-CA', {
    timeZone: 'America/New_York',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  let time = d.toLocaleTimeString('en-CA', {
    timeZone: 'America/New_York',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
  // Some engines render midnight as "24:00"; normalize to "00:00".
  if (time.startsWith('24:')) time = `00:${time.slice(3)}`;
  return { date, time };
}

export function entriesToCsv(entries: Entry[]): string {
  const lines: string[] = [HEADER.join(',')];
  for (const e of entries) {
    const { date, time } = easternDateTime(parseServerDate(e.timestamp));
    const row = [
      date,
      time,
      e.type,
      e.app,
      // Signed amount preserved as-stored (expenses/cancellations are negative)
      // so re-importing reproduces the exact same value.
      Number(e.amount ?? 0).toFixed(2),
      e.distance_miles ? String(e.distance_miles) : '',
      e.duration_minutes ? String(e.duration_minutes) : '',
      e.category ?? '',
      e.note ?? '',
    ].map((v) => csvEscape(String(v)));
    lines.push(row.join(','));
  }
  return lines.join('\n');
}

export type ExportResult = 'shared' | 'empty' | 'unavailable';

// Writes the entries to a CSV file in the cache dir and opens the native share
// sheet so the user can save it to Files, AirDrop, email, etc.
export async function exportEntriesCsv(
  entries: Entry[],
  baseName = 'earnings-ninja',
): Promise<ExportResult> {
  if (!entries.length) return 'empty';

  const csv = entriesToCsv(entries);
  const stamp = new Date().toISOString().slice(0, 10);
  const filename = `${baseName}-${stamp}.csv`;
  const dir = FileSystem.cacheDirectory ?? FileSystem.documentDirectory ?? '';
  const uri = dir + filename;

  await FileSystem.writeAsStringAsync(uri, csv, {
    encoding: FileSystem.EncodingType.UTF8,
  });

  if (!(await Sharing.isAvailableAsync())) return 'unavailable';

  await Sharing.shareAsync(uri, {
    mimeType: 'text/csv',
    dialogTitle: 'Export entries (CSV)',
    UTI: 'public.comma-separated-values-text',
  });

  return 'shared';
}
