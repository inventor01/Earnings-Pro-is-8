---
name: EAS submit retry & Apple upload limit
description: How to re-submit a FINISHED build, and Apple's ~7-uploads/day cap
---
- Re-submit an already-FINISHED EAS build with `GIT_CEILING_DIRECTORIES=/home/runner EAS_NO_VCS=1 npx eas submit --platform ios --profile testflight --id <buildId> --non-interactive --no-wait`. The `--profile testflight` flag is REQUIRED — without it eas ignores the submit profile's ASC config and fails with "Invalid Apple ID was specified".
- "Fastlane pilot failed / couldn't figure out what went wrong" is opaque; fetch the real error via GraphQL `submissions{byId{logsUrl}}` → curl `--compressed` (NDJSON) and grep for `[altool]`.
- Apple caps TestFlight uploads per app per day (~7). Error: 409 "Upload limit reached… wait 1 day". No workaround — the build stays reusable; just re-submit by id after the window resets.

## Promoting to another Play track (same versionCode)
`eas submit` re-uploads the AAB, so submitting an already-uploaded versionCode to a different track fails with OLD_VERSION_CODE_ERROR. Instead promote via the Play Developer API using the same service account: POST edits → PUT edits/{id}/tracks/{track} with the existing versionCodes → POST edits/{id}:commit. Default closed track name is `alpha`.
