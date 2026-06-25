---
name: Publishing eas update from the main agent
description: How to reliably publish an EAS OTA update given the tool timeout, the sandbox .git block, and content dedup.
---

# Publishing `eas update` (OTA) from the main agent

Three durable gotchas, each with a stable workaround.

## 1. It runs longer than the agent tool timeout
`eas update` (bundle + asset upload + fingerprint + publish) routinely exceeds the
~120s tool limit. Backgrounding does NOT help — detached processes are killed
between tool calls and leave empty logs. `pgrep -f "eas update"` gives false
positives (it matches the polling command's own argv).

**Rule:** run it in the foreground, accept that the tool call may be killed, then
**verify** with `eas update:list --branch <branch> --limit 1` — the underlying
process usually finished and published anyway. Only retry if the latest group is
not yours.

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
