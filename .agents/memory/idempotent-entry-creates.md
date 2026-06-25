---
name: Idempotent entry creates
description: Where the create idempotency key must be generated so a timed-out-but-saved POST and its offline replay dedupe correctly.
---

The key must be stamped on the payload BEFORE the first create attempt, then the
SAME payload object reused for both the first POST and the offline-queue enqueue.

**Why:** the duplicate bug is the "first POST reached the server and saved, but
the phone saw a timeout" case. The offline queue then replays. Only if the first
attempt AND the replay carry the *identical* key can the backend dedupe them.
Generating the key at enqueue time (a tempting, simpler spot) reintroduces the
bug: the first attempt would have no key (or a different one) than the replay, so
a timed-out-but-saved create still duplicates.

**How to apply:** in the client public create path, do
`withKey = entry.idempotency_key ? entry : {...entry, idempotency_key: gen()}`
once, then pass `withKey` to both the raw uploader and the queue. A fresh key per
create call is required so two *distinct* entries never collide and get one
wrongly deduped. Key gen is JS-only (timestamp + base36 randoms) — no crypto
native dep, keeps it OTA-safe.

Backend dedupes on `(user_id, idempotency_key)`: SELECT-existing-first returns the
canonical row; a partial unique index `WHERE idempotency_key IS NOT NULL` (allows
many NULL-key rows) plus an IntegrityError-rollback-requery covers concurrent
replay races. The column/index are added via an app.py `_migrate_*` helper
(ALTER TABLE ADD COLUMN + CREATE UNIQUE INDEX IF NOT EXISTS) before create_all.
Sending the key to an OLD backend is safe — Pydantic ignores the extra field, so
no dedup until the backend is deployed, but no errors either.
