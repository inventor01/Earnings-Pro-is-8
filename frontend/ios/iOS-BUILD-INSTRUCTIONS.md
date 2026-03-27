# Earnings Ninja - iOS App Store Build Instructions

## What You Need (One-Time Setup)
- Mac computer (macOS 12+)
- Xcode 15+ (free from Mac App Store)
- Apple Developer Account ($99/year at developer.apple.com)
- CocoaPods (install via Terminal: `sudo gem install cocoapods`)

---

## Step 1: Install Dependencies

Open Terminal on your Mac and run:

```bash
# Install CocoaPods if you haven't already
sudo gem install cocoapods

# Navigate to the iOS project
cd /path/to/earnings-ninja/frontend

# Install Node packages
npm install

# Install iOS pod dependencies
cd ios/App
pod install
```

---

## Step 2: Open in Xcode

```bash
# From the frontend directory
npx cap open ios
```

This opens **App.xcworkspace** in Xcode (always open the `.xcworkspace`, NOT the `.xcodeproj`).

---

## Step 3: Configure Signing in Xcode

1. Click **App** in the left sidebar (the blue icon)
2. Click the **Signing & Capabilities** tab
3. Under **Team**, select your Apple Developer account
4. Set **Bundle Identifier** to: `com.earningsninja.app`
5. Set **Version** to: `1.0`
6. Set **Build** to: `1`
7. Xcode will auto-generate your provisioning profile

---

## Step 4: App Store Connect Setup

1. Go to [appstoreconnect.apple.com](https://appstoreconnect.apple.com)
2. Click **My Apps** → **+** → **New App**
3. Fill in:
   - **Platform**: iOS
   - **Name**: Earnings Ninja
   - **Primary Language**: English (U.S.)
   - **Bundle ID**: com.earningsninja.app
   - **SKU**: earningsninja2025
   - **User Access**: Full Access
4. Click **Create**

---

## Step 5: Build for App Store

In Xcode:
1. Select **Any iOS Device (arm64)** as the build target (top left)
2. Go to **Product** → **Archive**
3. Wait for the archive to complete
4. The **Organizer** window will open automatically
5. Click **Distribute App**
6. Select **App Store Connect** → **Next**
7. Select **Upload** → **Next**
8. Keep defaults and click **Next** through the options
9. Click **Upload**

---

## Step 6: Submit for Review

Back in App Store Connect:
1. Go to your app → **1.0 Prepare for Submission**
2. Fill in:
   - **App Description**: Track your earnings across DoorDash, UberEats, Instacart, GrubHub and more. Set daily/weekly/monthly profit goals, track expenses, mileage, and maximize your income like a ninja.
   - **Keywords**: delivery driver, earnings tracker, doordash, ubereats, instacart, gig worker, mileage tracker, income tracker
   - **Category**: Finance (Primary), Productivity (Secondary)
   - **Support URL**: Your website URL
   - **Privacy Policy URL**: Your privacy policy URL
3. Upload **Screenshots** (required sizes):
   - iPhone 6.7": 1290 x 2796 pixels
   - iPhone 6.5": 1242 x 2688 pixels  
   - iPhone 5.5": 1242 x 2208 pixels
4. Select the build you uploaded
5. Click **Submit for Review**

---

## App Information Summary

| Field | Value |
|-------|-------|
| App Name | Earnings Ninja |
| Bundle ID | com.earningsninja.app |
| Version | 1.0 |
| Category | Finance |
| Price | Free (or your choice) |
| Age Rating | 4+ |

---

## Privacy Policy Requirements

Apple requires a privacy policy URL. You can create a simple one at:
- [privacypolicygenerator.info](https://privacypolicygenerator.info)
- [app-privacy-policy-generator.firebaseapp.com](https://app-privacy-policy-generator.firebaseapp.com)

Key points to include:
- We collect earnings/expense data you enter
- Data is stored securely on our servers
- We do not sell your data to third parties
- Location data is only used for trip mileage tracking
- Camera access is only used for receipt photos

---

## If You Get Build Errors

**"No signing certificate"**: Sign in to your Apple Developer account in Xcode Preferences → Accounts

**"CocoaPods not found"**: Run `sudo gem install cocoapods` then `pod install` in the `ios/App` folder

**"Missing provisioning profile"**: In Xcode → Signing & Capabilities → check "Automatically manage signing"

**Build succeeds but crashes on device**: Run on real device instead of simulator for testing
