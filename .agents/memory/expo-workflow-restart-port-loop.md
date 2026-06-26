---
name: Expo Mobile workflow restart port-8081 loop
description: Why restarting the Expo Mobile workflow can crash-loop on "Port 8081 is being used" and how to recover.
---

Restarting the `Expo Mobile` workflow (runs `keep-expo-alive.sh` → `expo start --tunnel`)
can leave a stale watchdog + expo/metro process holding port 8081. The freshly started
expo then hits the interactive `? Use port 8082 instead?` prompt, gets no TTY (stdin is
`/dev/null`), exits code 0, and the watchdog relaunches every 3s forever — log spams
`Port 8081 is being used by another process`.

**Why:** `restart_workflow` doesn't always reap the previous watchdog's expo/ngrok
children, so two instances fight over 8081.

**How to recover:**
1. Inspect with `ps -eo pid,ppid,args | grep -E '[k]eep-expo-alive|expo start'` and
   `lsof -i :8081` to find holders. `lsof` may show nothing even while expo reports the
   port busy (tunnel/ngrok timing).
2. Kill stale procs by PID — do NOT `pkill -9 -f 'expo start'`: your own bash command line
   contains that string, so pkill kills its own shell (exit 137) before finishing.
3. Single clean `restart_workflow("Expo Mobile")`.
4. Confirm via `refresh_all_logs` (the `/tmp/logs/*.log` snapshots are stale until
   re-refreshed). Healthy = `Tunnel connected. / Tunnel ready. / Metro waiting on ...`.

Two `keep-expo-alive.sh` ps entries (parent loop + backgrounded monitor/npx subshell)
is NORMAL, not a duplicate watchdog.
