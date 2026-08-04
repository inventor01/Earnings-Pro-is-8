---
name: Client/server validation lockstep
description: Validation limits duplicated in the mobile client and FastAPI backend must change together.
---

# Client/server validation lockstep

Rule: when relaxing or tightening any user-input limit in the mobile app (min/max lengths, counts, size caps), grep the backend pydantic validators for the same limit and change both in the same task.

**Why:** The bug-report min-description was lowered 20→3 chars only in the mobile modal; the backend validator still required 20, so short reports like "Crashed" passed the app's check but got a 422 on the live server — user saw a generic "Could not send your report" (pydantic 422 detail is a list, not a string, so the client's friendly-detail path can't surface it).

**How to apply:** Limits live in both `earnings-ninja-expo/components/*` (client constants) and `backend/routers/*` (pydantic field_validators). Also note: the backend deploys instantly via git push (Railway), while client changes need a native TestFlight build — so relaxing on the SERVER first is always safe; relaxing client-only is not.

**Aug 2026 recurrence:** bug-report screenshots — client allowed 5×2.6M-char data-URLs (~13M) but the server aggregate cap was 8M chars → 422 whose list-style detail the client couldn't parse, showing only a generic failure. Fix pattern: server cap must cover everything the client permits (now 14M vs client 13M), client enforces the aggregate at pick time, and `submitProblemReport` parses FastAPI 422 list details into a readable message.
