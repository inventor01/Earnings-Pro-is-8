---
name: Canvas preview iframe port
description: External port mapping for the analytics-variants component preview server
---
The `artifacts/analytics-variants` vite preview server listens locally on port 21353, but the public `$REPLIT_DOMAINS` proxy exposes it on **:3003**. A canvas iframe pointed at `:21353` shows a blank frame (connection fails externally) even though local screenshots of `127.0.0.1:21353` render fine.

**Why:** local reachability ≠ external reachability; the screenshot tool hits localhost while canvas iframes load in the user's browser through the proxy.

**How to apply:** build canvas iframe URLs as `https://<domain>:3003/preview/...` and `curl -s -o /dev/null -w "%{http_code}"` the exact external URL (expect 200) before flipping a frame to live.
