---
name: EAS build kickoff silent death after upload
description: eas build CLI can repeatedly die/hang after "Uploaded to EAS" without registering a build; how to recover.
---
The `eas build` CLI sometimes hangs or dies silently right after "✔ Uploaded to EAS" — no build is registered (verify with `eas build:list --json`, not the CLI output).

**Why:** the post-upload stage (fingerprint/runtime-version resolution) can stall in this environment; the process either hangs indefinitely or exits without registering.

**How to apply:**
- Always confirm registration via `eas build:list --json`; absence after ~3–5 min means the kickoff failed.
- Recovery that worked: re-run with `EXPO_DEBUG=1 DEBUG=*` (and `--no-wait`) via a wrapper script — registered immediately.
- Never `pkill -f 'eas build'` from a shell whose own command line contains that string — it self-kills the launcher. Launch via a `/tmp/*.sh` wrapper so kill patterns can't match the launching shell.
