---
name: Custom entry types base-type mapping
description: How user-created earnings types stay compatible with rollups, sign rules, and old clients
---

Custom Type-row options (user_entry_types) never introduce new enum values: entries store a BASE type — BONUS for kind='income', EXPENSE for kind='expense' — plus `custom_type=<name>` (mirrors custom_app pattern).

**Why:** order metrics filter `type=='ORDER'`, sign logic negates EXPENSE/CANCELLATION, and shipped builds only know the 4 enum values; a new enum value would break all three.

**How to apply:** any new "custom category" feature should reuse this pattern. Kind is fixed after creation (flipping would change history's meaning). custom_type may only ride on BONUS/EXPENSE — schema validator on create, post-apply check on partial update. Client key encoding `CUSTOMTYPE:<name>`; optimistic/offline paths (index onMutate rows, offlineQueue.synthesizeEntry, localStore synthFromCreate/applyPatch) must thread custom_type or the name degrades until refetch.

Also learned: pydantic `field_validator("x")(fn)` reuse inside a class body — once `_validate_fn = field_validator(...)(fn)` is assigned, the bare name in that class body resolves to the wrapped proxy, not the module function; a second reuse line must come BEFORE the shadowing assignment or it throws "not a callable object".

Guarded migrations that add an index to a NEW table no-op on the boot that introduces the table (they run before create_all); re-call them after create_all.
