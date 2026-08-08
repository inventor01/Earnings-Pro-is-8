// Failed-send draft for the Report a Problem form. Lives in AsyncStorage so a
// crash/network failure never loses what the user typed.
//
// Every operation is a no-op while the local sandbox Demo Mode is active:
// the sandbox must neither read a real user's saved draft, overwrite it with
// demo-typed input, nor remove it (two-way isolation — see lib/demoSession.ts).

import AsyncStorage from '@react-native-async-storage/async-storage';
import { isDemoActive } from './demoSession';

const DRAFT_KEY = 'problem-report-draft-v1';

export interface ReportDraft {
  reportType: string | null;
  title: string;
  description: string;
  steps: string;
  email: string;
}

export async function readReportDraft(): Promise<ReportDraft | null> {
  if (isDemoActive()) return null;
  try {
    const raw = await AsyncStorage.getItem(DRAFT_KEY);
    return raw ? (JSON.parse(raw) as ReportDraft) : null;
  } catch {
    return null;
  }
}

export async function saveReportDraft(d: ReportDraft): Promise<void> {
  if (isDemoActive()) return;
  try { await AsyncStorage.setItem(DRAFT_KEY, JSON.stringify(d)); } catch {}
}

export async function clearReportDraft(): Promise<void> {
  if (isDemoActive()) return;
  try { await AsyncStorage.removeItem(DRAFT_KEY); } catch {}
}
