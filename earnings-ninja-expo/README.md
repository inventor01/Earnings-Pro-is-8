# Earnings Ninja - Expo iOS App

This Expo app wraps the Earnings Ninja web app in a native iOS shell for App Store distribution.

---

## How to Build & Submit (No Mac Required!)

### Step 1: Install Expo CLI & EAS CLI

On any computer (Windows, Mac, Linux):
```bash
npm install -g expo-cli eas-cli
```

### Step 2: Create Expo Account

Sign up free at: https://expo.dev/signup

### Step 3: Log in

```bash
eas login
```

### Step 4: Install Dependencies

```bash
cd earnings-ninja-expo
npm install
```

### Step 5: Configure EAS Project

```bash
eas init
```
This links the project to your Expo account.

### Step 6: Build for iOS (Runs in the Cloud - No Mac Needed!)

```bash
eas build --platform ios --profile production
```

- EAS will ask for your Apple Developer credentials
- It builds the .ipa file in the cloud (takes ~10-20 minutes)
- You'll get a download link when done

### Step 7: Submit to App Store (Also Cloud-Based!)

```bash
eas submit --platform ios --latest
```

EAS will upload the .ipa directly to App Store Connect for you.

---

## Before Submitting - Update eas.json

Edit `eas.json` and fill in:
- `YOUR_APPLE_ID@email.com` → Your Apple ID email
- `YOUR_APP_STORE_CONNECT_APP_ID` → Found in App Store Connect
- `YOUR_TEAM_ID` → Found at developer.apple.com/account

---

## App Store Requirements Checklist

- [ ] Apple Developer Account ($99/year) - developer.apple.com
- [ ] Create app in App Store Connect (appstoreconnect.apple.com)
- [ ] App description written
- [ ] Screenshots taken (use iPhone 15 Pro Max sizes: 1290x2796)
- [ ] Privacy Policy URL (required by Apple)
- [ ] Category: Finance

---

## App Details

| Field | Value |
|-------|-------|
| App Name | Earnings Ninja |
| Bundle ID | com.earningsninja.app |
| Version | 1.0.0 |
| Loads from | https://earnings-pro-is-8-production.up.railway.app |

---

## Testing Before Submitting

Install Expo Go on your iPhone from the App Store, then run:
```bash
npx expo start
```
Scan the QR code to test on your real device instantly.
