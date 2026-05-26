#!/bin/bash
# Post-merge setup for Earnings Ninja monorepo.
# Runs after a task is merged into main to install any new deps and apply
# schema changes. Must be idempotent and non-interactive (stdin is closed).
set -euo pipefail

echo "[post-merge] Installing backend Python deps..."
pip install --quiet --disable-pip-version-check -r requirements.txt

for dir in frontend landing earnings-ninja-expo; do
  if [ -f "$dir/package.json" ]; then
    echo "[post-merge] Installing $dir deps..."
    # --legacy-peer-deps because the Expo SDK 54 tree has peer-dep
    # conflicts (react-native vs @radix-ui transitive) that npm 10
    # refuses by default. Expo itself recommends this flag.
    (cd "$dir" && npm install --no-audit --no-fund --prefer-offline --legacy-peer-deps)
  fi
done

echo "[post-merge] Done."
