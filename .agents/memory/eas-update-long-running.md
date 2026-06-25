---
name: Publishing eas update from the main agent
description: How to reliably publish an EAS OTA update given the tool timeout, the sandbox .git block, and content dedup.
---

# Publishing `eas update` (OTA) from the main agent

Three durable gotchas, each with a stable workaround.

## 1. It runs longer than the agent tool timeout
`eas update` (bundle + asset upload + fingerprint + publish) takes ~100s for this
app — close to the ~120s tool limit but it DOES fit. Run it in the FOREGROUND of a
single bash call (e.g. `time eas update … 2>&1 | tail -40`).

**Backgrounding (nohup/setsid) does NOT work and is a trap:** the sandbox reaps the
detached process the moment its launching bash call returns. It stays alive only
while a bash call is active, so it dies in the gap between calls — mid-bundle, log
frozen at "Starting Metro Bundler", nothing published. Do not believe "it probably
finished anyway"; in practice it does not. `pgrep -f "eas update"` also gives false
positives (it matches the polling command's own argv).

**Self-`pkill` trap (cause of mysterious exit 143):** any `pkill -f "<pat>"` whose
`<pat>` text also appears literally in the same bash script (e.g. `pkill -f "expo
start"` in a script that also launches/refers to expo, or `pkill -f "eas update"`)
matches the script's OWN shell and SIGTERMs it → exit 143, no output, before the
real work runs. Use patterns that can't match your own argv (e.g.
`global/bin/eas update`) or kill by PID.

**Verify** after publishing with `eas update:list --branch <branch> --limit 1`
(server is source of truth). Note: workflow-managed dev servers (Expo/Vite) auto-
respawn after `pkill`, so you can't "pause" them by killing — they were also a red
herring here (memory and Metro contention did not matter; foreground was the fix).

## 2. The sandbox blocks every `.git` write from the main agent
`eas`/`@expo/fingerprint` shell out to git, which wants `.git/index.lock`; the
sandbox blocks that for the main agent. A clean/committed tree does NOT help (the
block is categorical). `EAS_NO_VCS=1`/`GIT_OPTIONAL_LOCKS=0` alone don't help, and a
fake `git` breaks `expo-updates` (it runs `git --help` and needs exit 0).

**Working command** — hide the repo from git's upward search so git reports "not a
repo" while the binary still works:
```
cd earnings-ninja-expo
GIT_CEILING_DIRECTORIES=/home/runner/workspace EAS_NO_VCS=1 \
  eas update --branch preview --skip-bundler --input-dir dist --message "…"
```
`--skip-bundler --input-dir dist` reuses a pre-built `npx expo export` so the
publish fits in the tool timeout. (Same two env vars are needed for
`eas update:list`.)

**Fingerprint-safe:** JS-only changes under `lib/`/`app/` don't change the native
fingerprint, so the runtime version is unchanged and the installed build still gets
the OTA.

## 3. `eas update` deduplicates identical bundles
If the bundle+assets are byte-identical to a prior publish, eas reuses the existing
group and `✔ Published!` prints that OLD group's id/message/timestamp — looks like
your `--message`/code was ignored.

**Rule:** don't trust publish output; confirm via `eas update:list` (check the
timestamp + a unique marker in your message). If it deduped, your content is already
live; to force a new group, make any real one-line bundle change.
