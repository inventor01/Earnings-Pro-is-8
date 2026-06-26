import WidgetKit
import SwiftUI

// ─── Constants ────────────────────────────────────────────────────────────────
// Hard-coded to match `app.json` entitlements + `WidgetBridgeModule.swift`.
let APP_GROUP_ID = "group.com.earningsninja.shared"

// Dark Neon palette (mirrors the React Native app's `darkNeon` theme).
extension Color {
    static let neonBg     = Color(red: 0.039, green: 0.039, blue: 0.039) // #0a0a0a
    static let neonCard   = Color(red: 0.066, green: 0.066, blue: 0.066) // #111
    static let neonBorder = Color(red: 0.16,  green: 0.16,  blue: 0.16)  // #292929
    static let neonText   = Color.white
    static let neonMuted  = Color(red: 0.6,   green: 0.6,   blue: 0.6)   // #999
    static let neonYellow = Color(red: 0.98,  green: 0.80,  blue: 0.082) // #facc15
    static let neonGreen  = Color(red: 0.13,  green: 0.77,  blue: 0.37)  // #22c55e
    static let neonRed    = Color(red: 0.94,  green: 0.27,  blue: 0.27)  // #ef4444

    // Light theme — clean white surfaces; brand neon (yellow/green/red) reused.
    static let lightBg    = Color(red: 0.972, green: 0.980, blue: 0.988) // #f8fafc
    static let lightCard  = Color(red: 0.93,  green: 0.95,  blue: 0.97)  // ~#eef2f7
    static let lightMuted = Color(red: 0.392, green: 0.455, blue: 0.545) // #64748b
    static let lightText  = Color(red: 0.059, green: 0.090, blue: 0.165) // #0f172a
    static let lightGold  = Color(red: 0.631, green: 0.384, blue: 0.027) // #a16207 (readable accent on white)

    // Theme-aware pickers (true = light). Brand neon stays identical in both.
    static func wBg(_ light: Bool) -> Color         { light ? lightBg    : neonBg }
    static func wCard(_ light: Bool) -> Color       { light ? lightCard  : neonCard }
    static func wMuted(_ light: Bool) -> Color      { light ? lightMuted : neonMuted }
    static func wText(_ light: Bool) -> Color       { light ? lightText  : neonText }
    static func wAccentText(_ light: Bool) -> Color { light ? lightGold  : neonYellow }
}

// ─── Shared storage helpers ──────────────────────────────────────────────────
struct WidgetStore {
    static func defaults() -> UserDefaults? {
        UserDefaults(suiteName: APP_GROUP_ID)
    }

    /// Today's net profit (revenue − expenses), pushed by the RN app after
    /// each entry mutation via `lib/widgetSync.ts`. Returns 0 if absent.
    static var todayProfit: Double {
        guard let s = defaults()?.string(forKey: "today_profit"),
              let d = Double(s) else { return 0 }
        return d
    }

    /// Today's gross revenue (before expenses), pushed by the RN app alongside
    /// `today_profit` via `lib/widgetSync.ts`. Returns 0 if absent.
    static var todayRevenue: Double {
        guard let s = defaults()?.string(forKey: "today_revenue"),
              let d = Double(s) else { return 0 }
        return d
    }

    /// App theme pushed by `lib/widgetSync.ts` ("dark" | "light"). Defaults to
    /// dark so the widget matches the app's default appearance.
    static var isLight: Bool {
        defaults()?.string(forKey: "theme") == "light"
    }

    /// True only when the user has logged into the app at least once AND the
    /// API base is HTTPS (we refuse to send bearer tokens over cleartext).
    static var isReady: Bool {
        guard let d = defaults() else { return false }
        guard let token = d.string(forKey: "auth_token"), !token.isEmpty else { return false }
        guard let api = d.string(forKey: "api_base"), api.lowercased().hasPrefix("https://") else { return false }
        return true
    }
}

// ─── Timeline entry & provider ───────────────────────────────────────────────
struct EarningsEntry: TimelineEntry {
    let date: Date
    let profit: Double
    let revenue: Double
    let isReady: Bool
}

struct Provider: TimelineProvider {
    func placeholder(in context: Context) -> EarningsEntry {
        EarningsEntry(date: Date(), profit: 0, revenue: 0, isReady: true)
    }
    func getSnapshot(in context: Context, completion: @escaping (EarningsEntry) -> Void) {
        completion(EarningsEntry(
            date: Date(),
            profit: WidgetStore.todayProfit,
            revenue: WidgetStore.todayRevenue,
            isReady: WidgetStore.isReady
        ))
    }
    func getTimeline(in context: Context, completion: @escaping (Timeline<EarningsEntry>) -> Void) {
        let now = Date()
        let entry = EarningsEntry(
            date: now,
            profit: WidgetStore.todayProfit,
            revenue: WidgetStore.todayRevenue,
            isReady: WidgetStore.isReady
        )
        // Refresh every 15 minutes; mutations also reload via WidgetCenter.
        let next = Calendar.current.date(byAdding: .minute, value: 15, to: now) ?? now
        completion(Timeline(entries: [entry], policy: .after(next)))
    }
}

// ─── Sign-in placeholder ─────────────────────────────────────────────────────
// Shown when no auth_token exists in the App Group OR api_base is not HTTPS.
// Tapping opens the app via the widgetURL on the parent view.
struct SignInPlaceholder: View {
    var body: some View {
        VStack(spacing: 6) {
            Text("🥷")
                .font(.system(size: 32))
            Text("Sign in to Earnings Ninja")
                .font(.system(size: 11, weight: .semibold))
                .foregroundColor(.wMuted(WidgetStore.isLight))
                .multilineTextAlignment(.center)
            Text("Tap to open")
                .font(.system(size: 9, weight: .bold))
                .foregroundColor(.wAccentText(WidgetStore.isLight))
                .tracking(1)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }
}

// ─── Today's revenue line (shared by Home Screen views) ──────────────────────
@available(iOS 16.0, *)
struct RevenueLine: View {
    let revenue: Double
    var body: some View {
        HStack(spacing: 6) {
            Text("REVENUE")
                .font(.system(size: 9, weight: .bold))
                .foregroundColor(.wMuted(WidgetStore.isLight))
                .tracking(1)
            Spacer(minLength: 2)
            Text(formatProfit(revenue))
                .font(.system(size: 13, weight: .semibold))
                .foregroundColor(.wText(WidgetStore.isLight))
                .lineLimit(1)
                .minimumScaleFactor(0.6)
        }
    }
}

// ─── Small widget view (Home Screen) ─────────────────────────────────────────
// Display-only: today's net profit + gross revenue. Tapping anywhere opens the
// app at the entry-logger route (see `widgetURL` on the parent view).
@available(iOS 16.0, *)
struct EarningsWidgetSmallView: View {
    let entry: EarningsEntry

    var body: some View {
        if !entry.isReady {
            SignInPlaceholder()
        } else {
            VStack(alignment: .leading, spacing: 6) {
                Text("TODAY")
                    .font(.system(size: 9, weight: .bold))
                    .foregroundColor(.wMuted(WidgetStore.isLight))
                    .tracking(1.2)
                Text(formatProfit(entry.profit))
                    .font(.system(size: 26, weight: .heavy))
                    .foregroundColor(entry.profit >= 0 ? .neonGreen : .neonRed)
                    .lineLimit(1)
                    .minimumScaleFactor(0.6)
                    .shadow(color: (entry.profit >= 0 ? Color.neonGreen : Color.neonRed).opacity(0.5), radius: 6)
                Spacer(minLength: 4)
                RevenueLine(revenue: entry.revenue)
                Text("Tap to add an entry")
                    .font(.system(size: 9, weight: .bold))
                    .foregroundColor(.wAccentText(WidgetStore.isLight))
                    .tracking(0.5)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
        }
    }
}

// ─── Medium widget view (Home Screen) ────────────────────────────────────────
@available(iOS 16.0, *)
struct EarningsWidgetMediumView: View {
    let entry: EarningsEntry

    var body: some View {
        if !entry.isReady {
            SignInPlaceholder()
        } else {
            VStack(alignment: .leading, spacing: 10) {
                // Header
                HStack(alignment: .firstTextBaseline) {
                    VStack(alignment: .leading, spacing: 2) {
                        Text("TODAY")
                            .font(.system(size: 10, weight: .bold))
                            .foregroundColor(.wMuted(WidgetStore.isLight))
                            .tracking(1.5)
                        Text(formatProfit(entry.profit))
                            .font(.system(size: 34, weight: .heavy))
                            .foregroundColor(entry.profit >= 0 ? .neonGreen : .neonRed)
                            .lineLimit(1)
                            .minimumScaleFactor(0.6)
                            .shadow(color: (entry.profit >= 0 ? Color.neonGreen : Color.neonRed).opacity(0.5), radius: 8)
                    }
                    Spacer()
                    Text("🥷")
                        .font(.system(size: 30))
                        .shadow(color: Color.neonYellow.opacity(0.6), radius: 6)
                }
                Spacer(minLength: 2)
                RevenueLine(revenue: entry.revenue)
                Text("Tap to open Earnings Ninja")
                    .font(.system(size: 10, weight: .bold))
                    .foregroundColor(.wAccentText(WidgetStore.isLight))
                    .tracking(0.5)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
        }
    }
}

// ─── Lock Screen widget views ────────────────────────────────────────────────
// iOS 16+ accessory families — all glance-only. A single tap on any accessory
// opens the app at the entry-logger route via the parent's `widgetURL`.
@available(iOS 16.0, *)
struct EarningsWidgetInlineView: View {
    let entry: EarningsEntry
    var body: some View {
        Text(entry.isReady ? "🥷 Today: \(formatProfit(entry.profit))" : "🥷 Tap to sign in")
    }
}

@available(iOS 16.0, *)
struct EarningsWidgetCircularView: View {
    let entry: EarningsEntry
    var body: some View {
        Gauge(value: 0) {
            Text("🥷")
        } currentValueLabel: {
            Text(entry.isReady ? formatCompactProfit(entry.profit) : "—")
                .font(.system(size: 11, weight: .heavy))
        }
        .gaugeStyle(.accessoryCircular)
    }
}

@available(iOS 16.0, *)
struct EarningsWidgetRectangularView: View {
    let entry: EarningsEntry
    var body: some View {
        if entry.isReady {
            VStack(alignment: .leading, spacing: 3) {
                // Net Profit header line.
                HStack(spacing: 4) {
                    Text("🥷")
                        .font(.system(size: 11))
                    Text("NET")
                        .font(.system(size: 9, weight: .bold))
                        .tracking(1)
                    Spacer(minLength: 2)
                    Text(formatProfit(entry.profit))
                        .font(.system(size: 13, weight: .heavy))
                        .lineLimit(1)
                        .minimumScaleFactor(0.6)
                }
                // Today's gross Revenue line (mini-dashboard).
                HStack(spacing: 4) {
                    Text("REVENUE")
                        .font(.system(size: 9, weight: .bold))
                        .tracking(1)
                    Spacer(minLength: 2)
                    Text(formatProfit(entry.revenue))
                        .font(.system(size: 11, weight: .semibold))
                        .lineLimit(1)
                        .minimumScaleFactor(0.6)
                }
                Text("Tap to add entry")
                    .font(.system(size: 9))
            }
        } else {
            VStack(alignment: .leading, spacing: 1) {
                Text("EARNINGS NINJA")
                    .font(.system(size: 9, weight: .bold))
                    .tracking(1.2)
                Text("Tap to sign in")
                    .font(.system(size: 11, weight: .semibold))
            }
        }
    }
}

// ─── Widget bundle / entry point ─────────────────────────────────────────────
struct EarningsWidgetEntryView: View {
    var entry: Provider.Entry
    @Environment(\.widgetFamily) var family

    var body: some View {
        // The whole widget is a single tap target → opens the app at the
        // entry-logger route via deep link (`earningsninja://entry/new`).
        Group {
            switch family {
            case .accessoryInline:
                if #available(iOS 16.0, *) { EarningsWidgetInlineView(entry: entry) }
            case .accessoryCircular:
                if #available(iOS 16.0, *) { EarningsWidgetCircularView(entry: entry) }
            case .accessoryRectangular:
                if #available(iOS 16.0, *) { EarningsWidgetRectangularView(entry: entry) }
            case .systemMedium:
                if #available(iOS 16.0, *) { EarningsWidgetMediumView(entry: entry) }
            default:
                if #available(iOS 16.0, *) { EarningsWidgetSmallView(entry: entry) }
            }
        }
        .widgetURL(URL(string: "earningsninja://entry/new"))
    }
}

@available(iOS 16.0, *)
struct EarningsWidget: Widget {
    let kind: String = "EarningsWidget"

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: Provider()) { entry in
            EarningsWidgetEntryView(entry: entry)
                .containerBackground(for: .widget) { Color.wBg(WidgetStore.isLight) }
        }
        .configurationDisplayName("Earnings Ninja")
        .description("See today's profit at a glance. Tap to open the app.")
        .supportedFamilies([
            .systemSmall,
            .systemMedium,
            .accessoryInline,
            .accessoryCircular,
            .accessoryRectangular,
        ])
    }
}

@main
@available(iOS 16.0, *)
struct EarningsWidgetBundle: WidgetBundle {
    var body: some Widget {
        EarningsWidget()
    }
}

// ─── Number formatting helpers ───────────────────────────────────────────────
private func formatProfit(_ value: Double) -> String {
    let f = NumberFormatter()
    f.numberStyle = .currency
    f.currencyCode = "USD"
    f.maximumFractionDigits = (abs(value) >= 1000) ? 0 : 2
    f.minimumFractionDigits = (abs(value) >= 1000) ? 0 : 2
    return f.string(from: NSNumber(value: value)) ?? "$0.00"
}

/// Compact form for the tiny circular Lock Screen complication.
private func formatCompactProfit(_ value: Double) -> String {
    if abs(value) >= 1000 {
        return String(format: "$%.0fk", value / 1000)
    }
    return String(format: "$%.0f", value)
}
