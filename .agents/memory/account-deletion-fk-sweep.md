---
name: Account deletion FK sweep
description: Why delete-account must purge tables dynamically from ORM metadata, never a hardcoded list
---
**Rule:** DELETE /auth/account purges user data by iterating `reversed(Base.metadata.sorted_tables)` and deleting rows where ANY column FK-references `auth_users.id` (or_ across FK cols), then deletes the AuthUser row, in one transaction. Never reintroduce a hardcoded per-table delete list.

**Why:** The original hardcoded list rotted as the schema grew (daily_goals, user_platforms, user_entry_types, user_label_overrides, users, daily_usage, referrals, problem_reports were missed); the first missed table with rows made the final auth_users delete hit an FK constraint → production 500 "Could not delete account" (Aug 2026), an Apple 5.1.1(v) compliance risk.

**How to apply:** Any new table with a user FK is covered automatically — just declare the FK. Tests in `backend/tests/test_delete_account.py` run with SQLite `PRAGMA foreign_keys=ON` and scan metadata for orphan rows, so a table whose user column lacks a declared FK would silently escape both the sweep and the test — always declare `ForeignKey("auth_users.id")`.
