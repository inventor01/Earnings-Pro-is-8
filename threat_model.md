# Threat Model

## Project Overview

Earnings Ninja is a public, production-deployed delivery-driver earnings app with a FastAPI backend (`backend/`), a React web client (`frontend/`), a separate Expo mobile client (`earnings-ninja-expo/`), and a marketing site (`landing/`). The primary production trust boundary is the public internet to the FastAPI API mounted at `/api/*`; authenticated users can store financial entries, receipts, goals, social data, and optional third-party OAuth tokens for Uber/Shipt sync. The deployment is public on `*.replit.app`, so internet-reachable routes must be treated as production-exposed unless clearly marked otherwise.

## Assets

- **User accounts and sessions** — password hashes, password-reset tokens, JWT bearer tokens, Sign in with Apple identities. Compromise allows account takeover and access to financial history.
- **Driver financial data** — earnings, expenses, mileage, notes, goals, dashboard rollups, and receipt images. This is personal financial data and should remain scoped to the owning user.
- **Third-party platform credentials** — Uber and Shipt OAuth access/refresh tokens plus synced order metadata. Compromise allows continued access to upstream delivery-platform data.
- **Social graph and profile data** — usernames, email addresses, friendship state, congratulations, and leaderboard-derived statistics. Exposure can enable targeted harassment, spam, and user enumeration.
- **Operational secrets and email flows** — `JWT_SECRET_KEY`, Resend API key, OAuth client secrets, access codes, and password-reset links. Leakage enables impersonation or unauthorized access.

## Trust Boundaries

- **Browser / mobile app → FastAPI API** — all request bodies, query params, and headers are attacker-controlled until validated server-side.
- **FastAPI API → database** — user data, reset tokens, social data, and OAuth credentials are persisted here; authorization and deletion guarantees must be enforced before writes/reads.
- **FastAPI API → external services** — Resend, OpenAI, Apple JWKS, Uber, and Shipt receive server-side requests and sometimes user-derived data.
- **Public / authenticated boundary** — health, legal pages, waitlist flows, OAuth callbacks, signup/login/demo, and static assets are public; entries, settings, goals, rollups, dashboard, suggestions, leaderboard, and OAuth management are intended to be authenticated.
- **Authenticated user / other authenticated user boundary** — one user must never be able to view, link, mutate, or infer another user's private financial or identity data beyond explicitly intended social disclosures.
- **Production / dev-only boundary** — `backend/scripts/`, `backend/tests/`, `frontend/dev-dist/`, zip archives, and historical `deployment/` copies are usually non-production unless there is clear runtime reachability.

## Scan Anchors

- **Production entry points:** `backend/app.py`, routers in `backend/routers/`, deployment/runtime config in `.replit`, web auth state in `frontend/src/lib/authContext.tsx`, mobile auth/API in `earnings-ninja-expo/lib/`.
- **Highest-risk code areas:** auth/password reset (`backend/auth.py`, `backend/routers/auth_routes.py`), OAuth sync (`backend/routers/oauth.py`, `backend/services/sync_service.py`), user-data APIs (`entries`, `rollup`, `dashboard`, `goals`, `leaderboard`), and public marketing/prelaunch flows (`waitlist_routes`, `frontend/src/pages/PrelaunchPage.tsx`).
- **Public surfaces:** `/api/health`, `/api/auth/*` public endpoints, `/api/waitlist/*`, OAuth callbacks, `/privacy`, `/support`, static SPA routes.
- **Usually ignore unless proven reachable:** `backend/scripts/`, `backend/tests/`, `frontend/dev-dist/`, `deployment/`, archived zip files.

## Threat Categories

### Spoofing

The application relies on bearer JWTs and password-reset tokens to establish identity, plus Apple identity tokens and OAuth `state` values for third-party flows. All protected API routes must require a valid signed JWT tied to an existing `AuthUser`; public flows must not rely on client-side-only gates or default shared secrets to decide who may create or access accounts.

### Tampering

Users can submit entries, receipts, goals, friendship requests, and OAuth callback parameters. The backend must treat all client values as untrusted, enforce ownership on every mutation, validate sizes and formats, and ensure social or onboarding controls are enforced server-side rather than only in the SPA.

### Information Disclosure

This app stores sensitive financial history, receipt images, social identifiers, and upstream OAuth data. API responses must disclose only the minimum data required for the caller, password-reset flows must not leak valid tokens or email existence, and user-to-user features must not expose private email addresses or earnings data beyond the intended audience.

### Denial of Service

Public endpoints such as login, signup, password reset, waitlist signup, demo-session creation, and any upload-like receipt flow can be abused for resource exhaustion. Sensitive public routes should remain rate-limited, request sizes must stay bounded, and server-side integrations should avoid unbounded background work triggered by untrusted users.

### Elevation of Privilege

The most important privilege boundary is between one authenticated user and another. Routes that read leaderboard, social, or synced-platform data must enforce explicit authorization and least-privilege disclosure. Account-deletion and disconnect flows must revoke access to retained OAuth credentials so deleted accounts cannot keep pulling data or leave attacker-usable tokens behind.
