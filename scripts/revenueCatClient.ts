// RevenueCat REST client wired through the Replit RevenueCat connector.
// Integration: connection:conn_revenuecat (added via the integrations skill).
// The connector injects + refreshes OAuth auth automatically through the proxy
// fetch, so we never handle RevenueCat API keys directly here.
// Always call getUncachableRevenueCatClient() fresh — never cache the client,
// because the underlying identity token rotates.
import { ReplitConnectors } from "@replit/connectors-sdk";
import { createClient } from "@replit/revenuecat-sdk/client";

export async function getUncachableRevenueCatClient() {
  const connectors = new ReplitConnectors();
  const proxyFetch = connectors.createProxyFetch("revenuecat");

  return createClient({
    baseUrl: "https://api.revenuecat.com/v2",
    fetch: proxyFetch,
  });
}
