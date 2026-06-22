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
  // Extract the Eastern wall-clock components via formatToParts and zero-pad
  // them OURSELVES rather than trusting the engine's locale padding.
  //
  // Why: React Native's Hermes Intl can emit a SINGLE-DIGIT hour (e.g. "9:30"
  // or "0:05") for hours < 10 even with hour:'2-digit'/hour12:false (Node's
  // full ICU pads; Hermes does not). The backend then builds
  // `${date}T${time}:00` and calls datetime.fromisoformat(), which REJECTS a
  // non-zero-padded hour with ValueError — so the chosen date was silently
  // dropped on edit (caught + pass) or replaced with "now" on create (caught +
  // utcnow fallback). That manifested as "changing the date fails to save" for
  // any entry timed between midnight and 9:59am Eastern. Padding here fixes it
  // for both new and edited entries, in every timezone.
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(d);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '';
  const pad = (s: string) => s.padStart(2, '0');

  let hour = get('hour');
  // Some engines render midnight as "24" under hour12:false; normalize to "00".
  if (hour === '24') hour = '00';

  const date = `${get('year')}-${pad(get('month'))}-${pad(get('day'))}`;
  const time = `${pad(hour)}:${pad(get('minute'))}`;
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
