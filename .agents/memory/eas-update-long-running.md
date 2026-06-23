---
name: eas update exceeds the agent tool timeout
description: How to publish an EAS OTA update reliably given it runs longer than the 2-minute tool limit and detached processes get killed.
---

# Publishing `eas update` despite the 2-minute tool timeout

`eas update --branch preview` (bundle + asset upload + fingerprint + publish)
routinely runs **longer than the ~120s agent tool limit**.

Pitfalls observed:
- **Backgrounding does not help.** `nohup`/`setsid &` processes get terminated
  between tool calls and leave an **empty** log (no output captured).
- **`pgrep -f "eas update"` gives false positives** — it matches the polling
  shell command itself (whose argv contains the literal string "eas update"), so
  it falsely reports "RUNNING" forever. Do not trust it.

Reliable approach:
- Run `eas update` in the **foreground** piped to `tee /tmp/log`. Even when the
  tool call is killed at ~118s, the underlying process often finishes and writes
  `✔ Published!` to the log — so **check the log tail and `eas update:list
  --branch preview --limit 1`** afterward to confirm. It usually DID publish.

**Why:** avoids re-running an already-successful publish and avoids chasing a
phantom "stuck" process.

**How to apply:** publish in foreground, accept the tool timeout, then verify via
`eas update:list`; only retry if the latest published update is not yours.
