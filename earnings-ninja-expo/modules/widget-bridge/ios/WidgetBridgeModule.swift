import ExpoModulesCore
import WidgetKit

/// Tiny bridge so the JS layer can:
///   1. Read/write strings from the App Group's shared UserDefaults
///      (so the widget extension can see auth_token / api_base / today_profit)
///   2. Force the widget timeline to reload from JS
///
/// App Group ID is hard-coded to match `app.json`'s entitlements block.
public class WidgetBridgeModule: Module {
  private let appGroupId = "group.com.earningsninja.shared"

  public func definition() -> ModuleDefinition {
    Name("WidgetBridge")

    Constants([
      "appGroupId": appGroupId,
    ])

    Function("setItem") { (key: String, value: String?) -> Bool in
      guard let defaults = UserDefaults(suiteName: self.appGroupId) else {
        return false
      }
      if let v = value {
        defaults.set(v, forKey: key)
      } else {
        defaults.removeObject(forKey: key)
      }
      return true
    }

    Function("getItem") { (key: String) -> String? in
      guard let defaults = UserDefaults(suiteName: self.appGroupId) else {
        return nil
      }
      return defaults.string(forKey: key)
    }

    Function("reloadAllTimelines") {
      if #available(iOS 14.0, *) {
        WidgetCenter.shared.reloadAllTimelines()
      }
    }
  }
}
