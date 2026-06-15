---
name: Running `eas update` in this environment
description: eas update bundling outlasts the bash timeout and detached procs get reaped — run it as a one-shot workflow.
---

# Running `eas update` (OTA) in this environment

`eas update` Metro bundling for the Expo app takes ~3-5 min — longer than the
bash tool's 2-min cap. Backgrounding it (`nohup`/`setsid &`) does NOT survive:
the sandbox reaps processes spawned in a bash call once that call returns, so
the bundle silently dies with an empty log.

**Why:** bash tool calls are not a persistent session; only workflows are
managed/persistent.

**How to apply:** Run it as a one-shot **workflow** instead:
`configureWorkflow({ name:"EAS Update", command:"cd earnings-ninja-expo && eas update --branch preview --message \"...\" --non-interactive", outputType:"console", autoStart:true })`,
wait ~2 min, then `getWorkflowStatus({name:"EAS Update"})` until `state` is
`finished` and the output shows `✔ Published!`. Remove the workflow afterwards.
EXPO_TOKEN is already in the env. Same approach works for `eas build`.
