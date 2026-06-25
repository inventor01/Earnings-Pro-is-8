---
name: EAS store build credential bypass + ASC app-record limit
description: How to get an iOS App Store (store-distribution) EAS build to succeed when EAS's portal-based provisioning-profile creation fails with a bogus 403, and why eas submit needs a manually-created App Store Connect app record.
---

# EAS store build credential wall + the working bypass

**Symptom:** `eas build --profile <store>` for iOS reaches "Generate a new Apple
Provisioning Profile?" then dies with Apple 403 *"The selected team does not have a
program membership that is eligible for this feature."* It prompts for "Apple Team
Type" and prints *"not using Cookies (username/password)"*.

**Root cause (NOT membership):** `eas build` routes provisioning-profile creation
through the LEGACY Apple Developer Portal (fastlane spaceship). With App-Store-Connect
**API-key** (JWT, non-cookie) auth that legacy endpoint returns the bogus "not
eligible" 403. It is a tooling/auth-path limitation, not an account problem.

**Proof it's not membership:** the MODERN ASC API
(`POST https://api.appstoreconnect.apple.com/v1/profiles`, type `IOS_APP_STORE`)
creates the exact same profile → HTTP 201 with the *same* API key. GET
certs/bundleIds/profiles all 200.

**The working bypass — build with local credentials:**
1. Generate your own RSA-2048 key + CSR (`openssl genrsa` / `openssl req`).
2. `POST /v1/certificates` (`IOS_DISTRIBUTION`, your `csrContent`) → you now own the
   private key. Decode `certificateContent` (b64 DER) → PEM → `openssl pkcs12 -export
   -legacy` into a `.p12` (use `-legacy`; read it back with `-legacy` too on OpenSSL 3).
3. `POST /v1/profiles` once per target (`IOS_APP_STORE`, ref the new cert + each
   bundleId) → decode `profileContent` → `.mobileprovision` files. Profiles inherit
   the App ID's capabilities (App Groups, Sign In with Apple, aps-environment), so
   verify the decoded plist (`openssl smime -verify -noverify -inform DER`).
4. Write `<project>/credentials.json`. Multi-target = `ios` is a map keyed by **target
   name** (NOT bundle id), each `{provisioningProfilePath, distributionCertificate:{path,password}}`.
5. Set the build profile `"credentialsSource": "local"` in eas.json.
6. `eas build --platform ios --profile <store> --non-interactive` → logs
   "Using local iOS credentials (credentials.json)" and builds with NO portal calls.
**Why:** local credentials skip EAS's remote credential setup entirely, so the broken
legacy-portal path never runs. Fully non-interactive — no pty needed for the build.
Gitignore `credentials.json` + the cert/profile dir (private key + plaintext password).

# eas submit needs a pre-existing ASC app record (manual)
`POST /v1/apps` is FORBIDDEN by Apple's public API ("'apps' does not allow 'CREATE'";
allowed: GET/UPDATE). EAS can only create an app via a full Apple-ID cookie session
(interactive 2FA). So for a brand-new app the **user must create the App Store Connect
app record manually** (Apps → + → New App: platform iOS, name, primary language,
pick the registered bundle id, any SKU). Then fetch its numeric `appId` via
`GET /v1/apps`, put it in `submit.<profile>.ios.ascAppId`, and
`eas submit --platform ios --id <buildId> --non-interactive` (uses
EXPO_APPLE_ID + EXPO_APPLE_APP_SPECIFIC_PASSWORD for the Transporter upload).
