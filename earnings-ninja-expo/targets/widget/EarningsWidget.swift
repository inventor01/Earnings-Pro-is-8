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

    /// Last app the user logged an entry against (e.g. "DOORDASH"). The
    /// QuickAddIntent uses this so we don't need a per-button platform picker.
    static var lastApp: String {
        defaults()?.string(forKey: "last_app") ?? "DOORDASH"
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
    let isReady: Bool
}

struct Provider: TimelineProvider {
    func placeholder(in context: Context) -> EarningsEntry {
        EarningsEntry(date: Date(), profit: 0, isReady: true)
    }
    func getSnapshot(in context: Context, completion: @escaping (EarningsEntry) -> Void) {
        completion(EarningsEntry(
            date: Date(),
            profit: WidgetStore.todayProfit,
            isReady: WidgetStore.isReady
        ))
    }
    func getTimeline(in context: Context, completion: @escaping (Timeline<EarningsEntry>) -> Void) {
        let now = Date()
        let entry = EarningsEntry(
            date: now,
            profit: WidgetStore.todayProfit,
            isReady: WidgetStore.isReady
        )
        // Refresh every 15 minutes; mutations also reload via WidgetCenter.
        let next = Calendar.current.date(byAdding: .minute, value: 15, to: now) ?? now
        completion(Timeline(entries: [entry], policy: .after(next)))
    }
}

// ─── Quick-amount button (Home Screen widgets) ───────────────────────────────
@available(iOS 17.0, *)
struct QuickAmountButton: View {
    let amount: Int
    let kind: String   // "revenue" | "expense"
    let isExpense: Bool

    var body: some View {
        Button(intent: QuickAddIntent(kind: kind, amount: Double(amount))) {
            Text("$\(amount)")
                .font(.system(size: 16, weight: .heavy))
                .foregroundColor(isExpense ? .neonRed : .neonGreen)
                .frame(maxWidth: .infinity, minHeight: 32)
                .background(
                    RoundedRectangle(cornerRadius: 8)
                        .fill(Color.neonCard)
                        .overlay(
                            RoundedRectangle(cornerRadius: 8)
                                .stroke(isExpense ? Color.neonRed.opacity(0.4) : Color.neonGreen.opacity(0.4), lineWidth: 1)
                        )
                )
        }
        .buttonStyle(.plain)
    }
}

// ─── Compact quick-amount button (Lock Screen accessoryRectangular) ──────────
// iOS 17 allows interactive App Intent buttons inside Lock Screen widgets. The
// Lock Screen renders accessory widgets in `.vibrant` mode, so the system tints
// everything monochrome — we use a clear fill + thin stroke so the outline reads
// cleanly under that tint instead of fighting it with neon fills. Sized small to
// fit the short (~72pt) rectangular accessory next to the profit line.
@available(iOS 17.0, *)
struct LockQuickAmountButton: View {
    let amount: Int
    let kind: String   // "revenue" | "expense"
    let isExpense: Bool

    var body: some View {
        Button(intent: QuickAddIntent(kind: kind, amount: Double(amount))) {
            Text("\(isExpense ? "−" : "+")$\(amount)")
                .font(.system(size: 12, weight: .heavy))
                .frame(maxWidth: .infinity, minHeight: 20)
                .background(
                    RoundedRectangle(cornerRadius: 6)
                        .fill(Color.clear)
                        .overlay(
                            RoundedRectangle(cornerRadius: 6)
                                .stroke(lineWidth: 1)
                        )
                )
        }
        .buttonStyle(.plain)
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
                .foregroundColor(.neonMuted)
                .multilineTextAlignment(.center)
            Text("Tap to open")
                .font(.system(size: 9, weight: .bold))
                .foregroundColor(.neonYellow)
                .tracking(1)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }
}

// ─── Small widget view (Home Screen) ─────────────────────────────────────────
@available(iOS 17.0, *)
struct EarningsWidgetSmallView: View {
    let entry: EarningsEntry

    var body: some View {
        if !entry.isReady {
            SignInPlaceholder()
        } else {
            VStack(alignment: .leading, spacing: 6) {
                Text("TODAY")
                    .font(.system(size: 9, weight: .bold))
                    .foregroundColor(.neonMuted)
                    .tracking(1.2)
                Text(formatProfit(entry.profit))
                    .font(.system(size: 22, weight: .heavy))
                    .foregroundColor(entry.profit >= 0 ? .neonGreen : .neonRed)
                    .lineLimit(1)
                    .minimumScaleFactor(0.6)
                    .shadow(color: (entry.profit >= 0 ? Color.neonGreen : Color.neonRed).opacity(0.5), radius: 6)
                Spacer(minLength: 4)
                // Two revenue + two expense to honor the spec's
                // "+Revenue / +Expense buttons" requirement on the smallest tile.
                HStack(spacing: 6) {
                    QuickAmountButton(amount: 10, kind: "revenue", isExpense: false)
                    QuickAmountButton(amount: 25, kind: "revenue", isExpense: false)
                }
                HStack(spacing: 6) {
                    QuickAmountButton(amount: 10, kind: "expense", isExpense: true)
                    QuickAmountButton(amount: 25, kind: "expense", isExpense: true)
                }
            }
        }
    }
}

// ─── Medium widget view (Home Screen) ────────────────────────────────────────
@available(iOS 17.0, *)
struct EarningsWidgetMediumView: View {
    let entry: EarningsEntry

    var body: some View {
        if !entry.isReady {
            SignInPlaceholder()
        } else {
            VStack(alignment: .leading, spacing: 8) {
                // Header
                HStack(alignment: .firstTextBaseline) {
                    VStack(alignment: .leading, spacing: 2) {
                        Text("TODAY")
                            .font(.system(size: 10, weight: .bold))
                            .foregroundColor(.neonMuted)
                            .tracking(1.5)
                        Text(formatProfit(entry.profit))
                            .font(.system(size: 28, weight: .heavy))
                            .foregroundColor(entry.profit >= 0 ? .neonGreen : .neonRed)
                            .lineLimit(1)
                            .minimumScaleFactor(0.6)
                            .shadow(color: (entry.profit >= 0 ? Color.neonGreen : Color.neonRed).opacity(0.5), radius: 8)
                    }
                    Spacer()
                    Text("🥷")
                        .font(.system(size: 28))
                        .shadow(color: Color.neonYellow.opacity(0.6), radius: 6)
                }
                Spacer(minLength: 4)
                // Revenue row
                HStack(spacing: 6) {
                    Text("+ Revenue")
                        .font(.system(size: 9, weight: .bold))
                        .foregroundColor(.neonGreen)
                        .tracking(1)
                    Spacer()
                }
                HStack(spacing: 6) {
                    ForEach([10, 25, 50, 100], id: \.self) { amt in
                        QuickAmountButton(amount: amt, kind: "revenue", isExpense: false)
                    }
                }
                // Expense row
                HStack(spacing: 6) {
                    Text("− Expense")
                        .font(.system(size: 9, weight: .bold))
                        .foregroundColor(.neonRed)
                        .tracking(1)
                    Spacer()
                }
                HStack(spacing: 6) {
                    ForEach([5, 10, 25, 50], id: \.self) { amt in
                        QuickAmountButton(amount: amt, kind: "expense", isExpense: true)
                    }
                }
            }
        }
    }
}

// ─── Lock Screen widget views ────────────────────────────────────────────────
// iOS 16+ accessory families. `inline` and `circular` are too cramped for
// controls, so they stay glance-only (single tap opens the app). The
// `rectangular` family is roomy enough to show today's profit AND, on iOS 17+,
// host interactive + Revenue / − Expense quick-add buttons right on the Lock
// Screen — same App Intent the Home Screen widget uses, so it works fully via
// the shared App Group without opening the app.
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
                // Profit header line.
                HStack(spacing: 4) {
                    Text("🥷")
                        .font(.system(size: 11))
                    Text("TODAY")
                        .font(.system(size: 9, weight: .bold))
                        .tracking(1)
                    Spacer(minLength: 2)
                    Text(formatProfit(entry.profit))
                        .font(.system(size: 13, weight: .heavy))
                        .lineLimit(1)
                        .minimumScaleFactor(0.6)
                }
                // Interactive quick-add row (iOS 17+). On iOS 16 the buttons
                // aren't available, so fall back to the tap-to-open hint.
                if #available(iOS 17.0, *) {
                    HStack(spacing: 5) {
                        LockQuickAmountButton(amount: 10, kind: "revenue", isExpense: false)
                        LockQuickAmountButton(amount: 10, kind: "expense", isExpense: true)
                    }
                } else {
                    Text("Tap to add entry")
                        .font(.system(size: 9))
                }
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
        // Whole widget background tap → opens the app at the entry-logger
        // route via deep link. Quick-amount buttons sit on top and intercept
        // their own taps, so this only fires when the user taps empty space
        // (and on Lock Screen, where the entire surface is one tap target).
        Group {
            switch family {
            case .accessoryInline:
                if #available(iOS 16.0, *) { EarningsWidgetInlineView(entry: entry) }
            case .accessoryCircular:
                if #available(iOS 16.0, *) { EarningsWidgetCircularView(entry: entry) }
            case .accessoryRectangular:
                if #available(iOS 16.0, *) { EarningsWidgetRectangularView(entry: entry) }
            case .systemMedium:
                if #available(iOS 17.0, *) { EarningsWidgetMediumView(entry: entry) }
            default:
                if #available(iOS 17.0, *) { EarningsWidgetSmallView(entry: entry) }
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
                .containerBackground(for: .widget) { Color.neonBg }
        }
        .configurationDisplayName("Earnings Ninja")
        .description("Quick add revenue or expense entries.")
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
