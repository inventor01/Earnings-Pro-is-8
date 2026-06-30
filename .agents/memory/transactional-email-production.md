---
name: Transactional email production blockers
description: The three things that silently break Resend emails + reset links in production (Railway), and how the reset link must be served.
---

# Transactional email — production gotchas (Resend + Railway + landing SPA)

Three independent issues each silently break email for *real* users while looking
fine in dev. All three must hold for any email flow (welcome, verify, reset, MFA).

## 1. `onboarding@resend.dev` only delivers to the Resend account owner
Resend's shared sandbox sender is hard-restricted: it returns
"You can only send testing emails to your own email address" for any recipient
except the account owner. So every email to an actual user is REJECTED in prod.
**Fix:** sender is configurable via `RESEND_FROM` env (default still the sandbox).
Production MUST verify a domain at resend.com/domains and set `RESEND_FROM` to an
address on it (e.g. `Earnings Ninja <noreply@earningsninja.com>`). This is a USER
ACTION (needs DNS records).
**How to test without an inbox:** send to `delivered@resend.dev` (always accepted)
or to the owner address; sending to any other address surfaces the restriction
error verbatim.
**A @gmail.com can NEVER be the From sender** — Resend only verifies domains you
own via DNS, and nobody can add DNS to gmail.com. A gmail can only be the
**reply-to** (`RESEND_REPLY_TO` env, default `earningsninjaapp@gmail.com`), so
driver replies reach a monitored inbox; the From must still be the verified domain.

## 2. `get_app_url()` falls back to localhost on Railway
The app URL helper read only `REPLIT_DEV_DOMAIN`/`REPLIT_DOMAINS`, which do NOT
exist on Railway → reset links and the welcome button pointed at
`http://localhost:5000`.
**Fix:** prefer explicit `PUBLIC_APP_URL` (then `APP_BASE_URL`/`FRONTEND_URL`)
before the Replit envs. Set `PUBLIC_APP_URL=https://earningsninja.app` on Railway.

## 3. The reset page must live in the DEPLOYED SPA (landing/), not frontend/
Production serves `landing/dist` (see public-web-domain-serves-landing.md). The
real reset form was in `frontend/` which is never deployed, and the landing SPA's
history-router only matched `/upgrade`, so `/reset-password?token=…` fell through
to the marketing home page — the token could never be entered.
**Fix:** the reset page is a route in `landing/` itself; it reads `?token=` from
`window.location.search`, calls same-origin `GET /api/auth/verify-reset-token/{t}`
then `POST /api/auth/reset-password`. Any new email-linked web page must be added
to the landing router, not frontend/.

## Logging rule (applies to every emailed-secret function)
The runtime send-failure `except` must NOT print the secret (reset URL/token, MFA
or verify OTP). Plaintext is only acceptable in the explicit `if not RESEND_API_KEY`
dev branch. A leak here is account-takeover-grade.

## 4. Email HTML must be INLINE-styled — Gmail strips `<head><style>`
A `<head><style>{.button{...}}</style>` design renders fine in Apple Mail but
Gmail (web + app) strips the whole `<head>`, so class-based buttons collapse into
an unstyled text link → users perceive "the reset email is just a link/code, no
button." **Fix:** put every style as an inline `style="..."` attribute, and build
the CTA as a bulletproof button — a `<table>` with `bgcolor` on the `<td>` plus a
padded `<a>` (also inline-styled). This survives Gmail/Apple Mail/Outlook and is
tappable on mobile. Add `<meta name="viewport">` and always keep a plaintext part.

## 5. `resend.Emails.send` is SYNCHRONOUS — never call it bare in async code
The resend python SDK is blocking (requests under the hood). Calling it directly
inside an `async def` (route or BackgroundTask) stalls the single event loop until
Resend replies, serializing every other request behind each email. **Fix:**
`await asyncio.to_thread(resend.Emails.send, params)`. `resend.api_key` is a module
global set once at import, so the threaded call is safe.
