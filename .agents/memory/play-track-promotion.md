---
name: Play closed-track promotion
description: Getting an already-uploaded Android build onto a second Play track (alpha/closed)
---
`eas submit` re-uploads the AAB, so submitting the same versionCode to a second track fails with "You've already submitted this version". Promote instead: Play Developer API edits flow — POST /edits, PUT /edits/{id}/tracks/alpha with {releases:[{versionCodes:["N"],status:"completed"}]}, then :commit — signed with credentials/google-play-service-account.json (raw JWT via python cryptography works; googleapiclient not installed).
**How to apply:** whenever a build already on the internal track needs to reach the closed/alpha (or other) track.
