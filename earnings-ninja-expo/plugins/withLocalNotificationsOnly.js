const { withEntitlementsPlist, withInfoPlist } = require('expo/config-plugins');

/**
 * Local-notifications-only.
 *
 * expo-notifications' iOS config plugin (auto-applied from node_modules in SDK 54)
 * injects remote-push artifacts:
 *   - the `aps-environment` entitlement, and
 *   - `remote-notification` in UIBackgroundModes.
 * Both require the Push Notifications capability on the App ID / provisioning
 * profile, which makes EAS iOS builds fail. This app only schedules LOCAL
 * notifications (no push tokens), so we strip those artifacts here.
 */
module.exports = function withLocalNotificationsOnly(config) {
  config = withEntitlementsPlist(config, (cfg) => {
    delete cfg.modResults['aps-environment'];
    return cfg;
  });

  config = withInfoPlist(config, (cfg) => {
    const modes = cfg.modResults.UIBackgroundModes;
    if (Array.isArray(modes)) {
      const filtered = modes.filter((m) => m !== 'remote-notification');
      if (filtered.length) {
        cfg.modResults.UIBackgroundModes = filtered;
      } else {
        delete cfg.modResults.UIBackgroundModes;
      }
    }
    return cfg;
  });

  return config;
};
