---
name: Account-scoped AsyncStorage mirrors must be wiped on logout
description: Every per-account AsyncStorage mirror needs a clear* call in authContext clearAllLocalData
---
Rule: whenever a new per-account AsyncStorage mirror is added (platforms, label overrides, entry types, expense categories, hidden built-ins, etc.), its `clear*Mirror()` must be added to `clearAllLocalData()` in the auth context.

**Why:** Code review caught a cross-account leak — logging out and signing in as another user (offline or pre-refetch) inherited the previous account's custom categories/hidden built-ins. The entry-types mirror had the same latent leak.

**How to apply:** Any time a `read*Mirror`/`write*Mirror` pair is introduced, immediately add the matching clear to the logout wipe list and check the persisted React-Query cache covers its query key.
