// Account-zone ↔ device-zone bridge for the native DateTimePicker.
//
// The picker can only edit a DEVICE-LOCAL Date, but the app files entries by
// the ACCOUNT timezone. instantToPickerDate must produce a Date whose local
// fields equal the account-zone wall-clock, and pickerDateToInstant must
// invert it. Jest runs with TZ=UTC (jest-expo default) — distinct from every
// account zone tested here, which is exactly the traveling-user scenario.

import { instantToPickerDate, pickerDateToInstant } from '../lib/estRange';
import { setUserTz } from '../lib/userTz';

// Device zone under jest. If this fails, set TZ=UTC for the suite.
test('precondition: tests run with a UTC device clock', () => {
  expect(new Date().getTimezoneOffset()).toBe(0);
});

afterEach(() => { setUserTz('America/New_York'); });

test('picker shows the ACCOUNT-zone wall-clock, not device-local', () => {
  setUserTz('America/New_York');
  // 2026-06-15 13:00 UTC = 09:00 EDT
  const instant = new Date(Date.UTC(2026, 5, 15, 13, 0, 0));
  const p = instantToPickerDate(instant);
  expect([p.getFullYear(), p.getMonth() + 1, p.getDate(), p.getHours(), p.getMinutes()])
    .toEqual([2026, 6, 15, 9, 0]);
});

test('round-trip: picking "9:00 AM" saves 9:00 AM in the account zone', () => {
  setUserTz('America/New_York');
  const instant = new Date(Date.UTC(2026, 5, 15, 13, 0, 0));
  // User leaves the wheel at 9:00 AM → we must get the same instant back.
  expect(pickerDateToInstant(instantToPickerDate(instant)).getTime())
    .toBe(instant.getTime());
});

test('device zone ≠ account zone: LA device, New York account', () => {
  setUserTz('America/New_York');
  // A picker Date built as local 9:00 (whatever the device zone) must be
  // interpreted as 9:00 AM Eastern = 13:00 UTC in June (EDT).
  const picked = new Date(2026, 5, 15, 9, 0, 0);
  expect(pickerDateToInstant(picked).getTime())
    .toBe(Date.UTC(2026, 5, 15, 13, 0, 0));
});

test('midnight boundary: 00:30 in the account zone stays on the picked day', () => {
  setUserTz('America/Los_Angeles');
  // 00:30 Pacific on June 15 = 07:30 UTC June 15
  const picked = new Date(2026, 5, 15, 0, 30, 0);
  const instant = pickerDateToInstant(picked);
  expect(instant.getTime()).toBe(Date.UTC(2026, 5, 15, 7, 30, 0));
  // And it renders back as the same account-zone wall clock (same day).
  const back = instantToPickerDate(instant);
  expect([back.getDate(), back.getHours(), back.getMinutes()]).toEqual([15, 0, 30]);
});

test('far zone: Tokyo account, winter instant', () => {
  setUserTz('Asia/Tokyo');
  // 23:00 UTC Jan 10 = 08:00 JST Jan 11 — crosses the day boundary.
  const instant = new Date(Date.UTC(2026, 0, 10, 23, 0, 0));
  const p = instantToPickerDate(instant);
  expect([p.getMonth() + 1, p.getDate(), p.getHours()]).toEqual([1, 11, 8]);
  expect(pickerDateToInstant(p).getTime()).toBe(instant.getTime());
});

test('DST spring-forward: nonexistent 2:30 AM resolves without shifting a day', () => {
  setUserTz('America/New_York');
  // 2026-03-08 02:30 EST/EDT does not exist; helper must still land on Mar 8.
  const instant = pickerDateToInstant(new Date(2026, 2, 8, 2, 30, 0));
  const back = instantToPickerDate(instant);
  expect([back.getMonth() + 1, back.getDate()]).toEqual([3, 8]);
});
