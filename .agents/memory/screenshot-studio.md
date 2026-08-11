---
name: Screenshot Studio (dev web composer)
description: Dev-only /screenshot-studio route in the Expo app; frames the REAL app via same-origin iframe with ?ssdemo=1; iframe gotchas.
---
The marketing screenshot composer lives at `/screenshot-studio` on the Expo **web** dev server (port 8081). It iframes the app itself with `?ssdemo=1`.

Key rules:
- `?ssdemo=1` is handled in auth bootstrap (`lib/authContext.tsx`), **before** token load, so the iframe can never inherit a real logged-in session (dev+web only, dead in native/prod).
- RootNav's auth redirects exempt the exact `/screenshot-studio` pathname; anything else gets yanked to /login before it can render.
- `react-native-web` + `react-dom` had to be installed for expo web to bundle at all.

**Why:** store screenshots must show the real UI (never recreations) and never leak real account data.

Iframe gotchas learned:
- Chrome paints an opaque BLACK canvas for iframes whose color-scheme mismatches the embedder; pin `colorScheme:'light'` on the iframe and never put the scale transform on the iframe element itself (wrapper div instead).
- Headless screenshot tools capture before a second full dev-bundle app instance finishes booting inside an iframe — a black frame in automated captures is usually boot timing, not a bug. Verify in a real browser.
- Export flow: "Capture mode (100%)" renders the canvas at exact store px; capture via devtools "Capture node screenshot" on `#ss-canvas`.
