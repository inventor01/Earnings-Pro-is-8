// ─── Local sandbox Demo Mode: api adapter ────────────────────────────────────
//
// Implements the same surface as the real `api` object (lib/api.ts) against
// the in-memory demo store, so every screen's React Query hooks work
// unchanged in demo mode. lib/api.ts wraps its export in a Proxy that routes
// to these implementations whenever a demo session is active — one central
// switch, zero per-screen conditionals.
//
// Account-level operations that make no sense in a sandbox (change email,
// delete account, MFA, referrals-redeem, …) throw a friendly "create an
// account" error instead of silently no-oping, and reads that Settings pages
// perform on mount (MFA status, email-verification status) return benign
// static values so no screen breaks.

import type {
  Entry, EntryCreate, Goal, Rollup, TimeframeType, User,
  UserPlatform, UserEntryType, UserExpenseCategory, LabelOverride,
  ReferralInfo, RedeemResponse,
} from './api';
import { DEMO_USER } from './demoSession';
import { noteDemoEntryAdded } from './demoSession';
import {
  demoRollup, demoRollupInRange, demoEntries, demoEntriesInRange, demoAllEntries,
  demoCreateEntry, demoUpdateEntry, demoDeleteEntry, demoImportEntries,
  demoGetGoal, demoUpsertGoal, demoGetDailyGoal, demoUpsertDailyGoal,
  demoGetPlatforms, demoAddPlatform, demoRenamePlatform, demoDeletePlatform,
  demoGetEntryTypes, demoAddEntryType, demoRenameEntryType, demoDeleteEntryType,
  demoGetExpenseCats, demoAddExpenseCat, demoRenameExpenseCat, demoDeleteExpenseCat,
  demoGetHiddenCats, demoSetHiddenCats, demoGetLabelOverrides, demoSetLabelOverride,
} from './demoStore';

function notInDemo(action: string): never {
  throw new Error(`${action} isn’t available in Demo Mode. Create a free account to use it.`);
}

export const demoApi = {
  // ── Profile / auth-adjacent reads ─────────────────────────────────────────
  async getMe(): Promise<User> {
    return { ...DEMO_USER };
  },
  async completeOnboarding(): Promise<{ onboarding_completed: boolean }> {
    return { onboarding_completed: true };
  },
  async completeWalkthrough(): Promise<{ walkthrough_completed: boolean }> {
    return { walkthrough_completed: true };
  },
  async getMfaStatus(): Promise<{ enabled: boolean; email?: string }> {
    return { enabled: false, email: DEMO_USER.email };
  },
  async getEmailVerifyStatus(): Promise<{ email?: string; email_verified: boolean; needs_verification: boolean }> {
    return { email: DEMO_USER.email, email_verified: true, needs_verification: false };
  },
  async getReferralInfo(): Promise<ReferralInfo> {
    return { code: 'DEMO', referred_count: 0, rewards_earned: 0, rewards_cap: 0, rewards_remaining: 0 };
  },

  // ── Blocked account operations (friendly, explicit) ───────────────────────
  async changeUsername(): Promise<never> { notInDemo('Changing your username'); },
  async changeEmail(): Promise<never> { notInDemo('Changing your email'); },
  async deleteAccount(): Promise<never> { notInDemo('Deleting an account'); },
  async enableMfa(): Promise<never> { notInDemo('Two-factor authentication'); },
  async disableMfa(): Promise<never> { notInDemo('Two-factor authentication'); },
  async verifyEmail(): Promise<never> { notInDemo('Email confirmation'); },
  async resendEmailVerification(): Promise<never> { notInDemo('Email confirmation'); },
  async redeemReferral(_code: string): Promise<RedeemResponse> { notInDemo('Referral codes'); },

  // ── Entries & rollups ─────────────────────────────────────────────────────
  async getRollup(timeframe: string = 'TODAY', dayOffset: number = 0): Promise<Rollup> {
    return demoRollup(timeframe, dayOffset);
  },
  async getRollupInRange(fromIso: string, toIso: string): Promise<Rollup> {
    return demoRollupInRange(fromIso, toIso);
  },
  async getEntries(timeframe: string = 'TODAY', limit = 200, dayOffset: number = 0): Promise<Entry[]> {
    return demoEntries(timeframe, limit, dayOffset);
  },
  async getEntriesInRange(fromIso: string, toIso: string, limit = 1000): Promise<Entry[]> {
    return demoEntriesInRange(fromIso, toIso, limit);
  },
  async getAllEntries(): Promise<Entry[]> {
    return demoAllEntries();
  },
  async createEntry(entry: EntryCreate): Promise<Entry> {
    const saved = demoCreateEntry(entry);
    noteDemoEntryAdded();
    return saved;
  },
  async createEntryRaw(entry: EntryCreate): Promise<Entry> {
    return demoCreateEntry(entry);
  },
  async updateEntry(entryId: number, patch: Partial<EntryCreate>): Promise<Entry> {
    return demoUpdateEntry(entryId, patch);
  },
  async updateEntryRaw(entryId: number, patch: Partial<EntryCreate>): Promise<Entry> {
    return demoUpdateEntry(entryId, patch);
  },
  async deleteEntry(entryId: number): Promise<void> {
    demoDeleteEntry(entryId);
  },
  async deleteEntryRaw(entryId: number): Promise<void> {
    demoDeleteEntry(entryId);
  },
  async importEntries(entries: EntryCreate[]): Promise<{ count: number; message: string }> {
    const count = demoImportEntries(entries);
    return { count, message: `Imported ${count} entries into the demo (not saved to an account).` };
  },

  // ── Goals ─────────────────────────────────────────────────────────────────
  async getGoal(timeframe: TimeframeType): Promise<Goal | null> {
    return demoGetGoal(timeframe);
  },
  async upsertGoal(timeframe: TimeframeType, target_profit: number): Promise<Goal> {
    return demoUpsertGoal(timeframe, target_profit);
  },
  async upsertGoalRaw(timeframe: TimeframeType, target_profit: number): Promise<Goal> {
    return demoUpsertGoal(timeframe, target_profit);
  },
  async getDailyGoal(dateIso: string): Promise<Goal | null> {
    return demoGetDailyGoal(dateIso);
  },
  async upsertDailyGoal(dateIso: string, target_profit: number): Promise<Goal> {
    return demoUpsertDailyGoal(dateIso, target_profit);
  },
  async upsertDailyGoalRaw(dateIso: string, target_profit: number): Promise<Goal> {
    return demoUpsertDailyGoal(dateIso, target_profit);
  },

  // ── Custom platforms / types / categories / labels ───────────────────────
  async getPlatforms(): Promise<UserPlatform[]> { return demoGetPlatforms(); },
  async addPlatform(name: string, color?: string | null, icon?: string | null): Promise<UserPlatform> {
    return demoAddPlatform(name, color, icon);
  },
  async renamePlatform(pid: number, name: string, color?: string | null, icon?: string | null): Promise<UserPlatform> {
    return demoRenamePlatform(pid, name, color, icon);
  },
  async deletePlatform(pid: number): Promise<void> { demoDeletePlatform(pid); },

  async getEntryTypes(): Promise<UserEntryType[]> { return demoGetEntryTypes(); },
  async addEntryType(name: string, kind: 'income' | 'expense', color?: string | null, icon?: string | null): Promise<UserEntryType> {
    return demoAddEntryType(name, kind, color, icon);
  },
  async renameEntryType(tid: number, name: string, color?: string | null, icon?: string | null): Promise<UserEntryType> {
    return demoRenameEntryType(tid, name, color, icon);
  },
  async deleteEntryType(tid: number): Promise<void> { demoDeleteEntryType(tid); },

  async getExpenseCategories(): Promise<UserExpenseCategory[]> { return demoGetExpenseCats(); },
  async addExpenseCategory(name: string, color?: string | null, icon?: string | null): Promise<UserExpenseCategory> {
    return demoAddExpenseCat(name, color, icon);
  },
  async renameExpenseCategory(cid: number, name: string, color?: string | null, icon?: string | null): Promise<UserExpenseCategory> {
    return demoRenameExpenseCat(cid, name, color, icon);
  },
  async deleteExpenseCategory(cid: number): Promise<void> { demoDeleteExpenseCat(cid); },

  async getHiddenExpenseCategories(): Promise<string[]> { return demoGetHiddenCats(); },
  async setHiddenExpenseCategories(keys: string[]): Promise<string[]> { return demoSetHiddenCats(keys); },

  async getLabelOverrides(): Promise<LabelOverride[]> { return demoGetLabelOverrides(); },
  async setLabelOverride(kind: 'platform' | 'type', key: string, label: string | null): Promise<LabelOverride[]> {
    return demoSetLabelOverride(kind, key, label);
  },
};
