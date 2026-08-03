/**
 * Submit-gate logic for the Report a Problem form.
 *
 * Regression guard for two user-reported issues:
 *  1) "Submit Report" looked broken — a 20-char description minimum silently
 *     disabled it. The minimum is now tiny (3 chars) so short-but-valid
 *     reports like "Crashed" go through, and any remaining block produces a
 *     human-readable reason (shown in an alert on tap) instead of a dead button.
 *  2) Drafts must not resurrect stale text on every reopen (covered by the
 *     component: drafts are only written on a failed send).
 */
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

import { submitBlockedReason } from '../components/ReportProblemModal';

const base = {
  reportType: 'App Crash' as string | null,
  description: 'Crashed',
  email: 'user@example.com',
};

describe('submitBlockedReason', () => {
  it('allows a short description like "Crashed"', () => {
    expect(submitBlockedReason(base)).toBeNull();
  });

  it('blocks when no report type is chosen, mentioning the dropdown', () => {
    const r = submitBlockedReason({ ...base, reportType: null });
    expect(r).toMatch(/kind of issue/i);
  });

  it('blocks an effectively empty description (whitespace only / too short)', () => {
    expect(submitBlockedReason({ ...base, description: '  ' })).toMatch(/description/i);
    expect(submitBlockedReason({ ...base, description: 'ab' })).toMatch(/description/i);
  });

  it('uses feature-request wording for idea descriptions', () => {
    const r = submitBlockedReason({ ...base, description: '', isFeatureRequest: true });
    expect(r).toMatch(/idea/i);
  });

  it('blocks an invalid email with a follow-up hint', () => {
    expect(submitBlockedReason({ ...base, email: 'not-an-email' })).toMatch(/email/i);
    expect(submitBlockedReason({ ...base, email: '' })).toMatch(/email/i);
  });

  it('checks in order: type, then description, then email', () => {
    const r = submitBlockedReason({ reportType: null, description: '', email: 'bad' });
    expect(r).toMatch(/kind of issue/i);
  });
});
