import AppIntents
import WidgetKit
import Foundation

/// Serializes optimistic `today_profit` / `today_revenue` updates so concurrent
/// quick-add taps don't lose increments via read-then-write races.
private let profitWriteQueue = DispatchQueue(label: "com.earningsninja.widget.profit")

/// App Intent fired by quick-amount buttons in the widget.
///
/// Flow:
///   1. Read `auth_token` + `api_base` from the App Group's UserDefaults
///      (the RN app keeps these in sync via `lib/widgetSync.ts`).
///   2. Refuse to attach the bearer token unless `api_base` is HTTPS.
///   3. Build an Entry payload — REVENUE goes in as a positive ORDER on the
///      user's last-used app; EXPENSE goes in as a negative OTHER expense.
///   4. POST to `/api/entries`.
///   5. Atomically bump `today_profit` (and, for revenue actions, `today_revenue`)
///      in App Group storage so the widget reflects the new value immediately,
///      then reload all widget timelines. Expenses are revenue-neutral — they
///      only move net profit, never the gross-revenue line.
///
/// `openAppWhenRun = false` keeps the user on Home Screen — the entry is
/// saved silently. When credentials are missing the widget surface itself
/// renders a "Sign in" placeholder (see `EarningsWidget.swift`), so the
/// quick-add buttons aren't reachable in that state.
@available(iOS 17.0, *)
struct QuickAddIntent: AppIntent {
    static var title: LocalizedStringResource = "Add Earnings Entry"
    static var description = IntentDescription("Quickly log revenue or an expense.")
    static var openAppWhenRun: Bool = false

    // Require the user to prove presence (Face ID, Touch ID, or passcode) before
    // the intent executes. This prevents someone with brief physical access to a
    // locked iPhone from silently writing entries to the account. On the Home
    // Screen the device is already unlocked so the prompt is not shown; it only
    // engages when the button is tapped from the Lock Screen.
    static var authenticationPolicy: IntentAuthenticationPolicy = .requiresLocalAuthentication

    @Parameter(title: "Kind")
    var kind: String   // "revenue" | "expense"

    @Parameter(title: "Amount")
    var amount: Double

    init() {}
    init(kind: String, amount: Double) {
        self.kind = kind
        self.amount = amount
    }

    func perform() async throws -> some IntentResult {
        guard let defaults = UserDefaults(suiteName: APP_GROUP_ID) else {
            return .result()
        }
        guard
            let token   = defaults.string(forKey: "auth_token"), !token.isEmpty,
            let apiBase = defaults.string(forKey: "api_base"),
            // SECURITY: never attach a bearer token to a cleartext URL —
            // even though the dev build allows arbitrary loads, the widget
            // refuses to participate in any non-HTTPS API call.
            apiBase.lowercased().hasPrefix("https://"),
            let url     = URL(string: "\(apiBase)/api/entries")
        else {
            // Reload the widget so its UI flips to the "Sign in" placeholder
            // (or stays there) — the user can then tap the body to open the app.
            WidgetCenter.shared.reloadAllTimelines()
            return .result()
        }

        let isExpense = (kind == "expense")
        let lastApp   = defaults.string(forKey: "last_app") ?? "DOORDASH"
        let signedAmount = isExpense ? -abs(amount) : abs(amount)

        var body: [String: Any] = [
            "type":   isExpense ? "EXPENSE" : "ORDER",
            "app":    isExpense ? "OTHER"   : lastApp,
            "amount": signedAmount,
            "note":   "Quick add from widget",
        ]
        if isExpense { body["category"] = "OTHER" }

        var req = URLRequest(url: url)
        req.httpMethod = "POST"
        req.setValue("application/json", forHTTPHeaderField: "Content-Type")
        req.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        req.httpBody = try? JSONSerialization.data(withJSONObject: body)
        req.timeoutInterval = 10

        do {
            let (_, resp) = try await URLSession.shared.data(for: req)
            if let http = resp as? HTTPURLResponse, (200...299).contains(http.statusCode) {
                // Atomic optimistic update — serialized so concurrent taps
                // don't read-then-overwrite each other.
                profitWriteQueue.sync {
                    let prevProfit = Double(defaults.string(forKey: "today_profit") ?? "0") ?? 0
                    defaults.set(String(format: "%.2f", prevProfit + signedAmount), forKey: "today_profit")
                    // Revenue actions also move the gross-revenue line; expenses
                    // are revenue-neutral (they only affect net profit).
                    if !isExpense {
                        let prevRevenue = Double(defaults.string(forKey: "today_revenue") ?? "0") ?? 0
                        defaults.set(String(format: "%.2f", prevRevenue + abs(amount)), forKey: "today_revenue")
                    }
                }
            }
        } catch {
            // Swallow network errors silently — the user will see them next
            // time they open the app and the entry won't appear, which is
            // honest about what happened.
        }

        WidgetCenter.shared.reloadAllTimelines()
        return .result()
    }
}
