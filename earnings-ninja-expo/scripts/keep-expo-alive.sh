#!/usr/bin/env bash
# Watchdog wrapper for `expo start --tunnel`.
#
# Expo Go's free ngrok tunnel is flaky (drops every ~1-2 hrs, plus occasional
# startup TypeErrors). This wrapper:
#   1. Runs `npx expo start --tunnel` in a loop forever.
#   2. After 90s warmup, polls the tunnel /status endpoint every 30s.
#   3. On 3 consecutive failures, kills expo so the loop restarts it.
#   4. 3s cooldown between restarts.
#
# The tunnel hostname is hardcoded because Expo's anonymous ngrok subdomain
# is deterministic per machine — it's been `ccpvuxk-anonymous-8081` every
# restart on this Replit container. If it ever changes, update TUNNEL_URL.
set -u
cd "$(dirname "$0")/.."

LOG="[watchdog]"
TUNNEL_URL="https://ccpvuxk-inventor01-8081.exp.direct"

log() { echo "$LOG $*"; }

cleanup() {
  [ -n "${MON_PID:-}" ]  && kill "$MON_PID"  2>/dev/null
  [ -n "${EXPO_PID:-}" ] && kill "$EXPO_PID" 2>/dev/null
  exit 0
}
trap cleanup INT TERM

monitor() {
  local pid="$1" fails=0 code
  sleep 90
  while kill -0 "$pid" 2>/dev/null; do
    code=$(curl -sS -o /dev/null -w "%{http_code}" --max-time 8 \
              "${TUNNEL_URL}/status" 2>/dev/null || echo 000)
    # 200 = Metro served /status; 426 = WebSocket upgrade required (also alive).
    if [ "$code" = "200" ] || [ "$code" = "426" ]; then
      [ "$fails" -gt 0 ] && log "tunnel recovered (code=$code)"
      fails=0
    else
      fails=$((fails+1))
      log "tunnel probe code=$code (fail ${fails}/3)"
      if [ "$fails" -ge 3 ]; then
        log "tunnel dead, restarting expo (pid=$pid)"
        kill -TERM "$pid" 2>/dev/null
        sleep 3
        kill -KILL "$pid" 2>/dev/null
        return
      fi
    fi
    sleep 30
  done
}

while true; do
  log "starting expo (npx expo start --tunnel)"
  npx expo start --tunnel < /dev/null &
  EXPO_PID=$!
  log "expo pid=$EXPO_PID, monitoring $TUNNEL_URL"

  monitor "$EXPO_PID" &
  MON_PID=$!

  wait "$EXPO_PID" 2>/dev/null
  EXIT_CODE=$?
  kill "$MON_PID" 2>/dev/null
  log "expo exited (code=$EXIT_CODE), restarting in 3s"
  sleep 3
done
