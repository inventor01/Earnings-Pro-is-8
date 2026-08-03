// Inspect Android (Play Store) provisioning state in RevenueCat:
// apps, play products, entitlement mapping, offering packages, and the
// publishable goog_ API key for the Play Store app.
import { getUncachableRevenueCatClient } from "./revenueCatClient";
import {
  listApps,
  listProducts,
  listEntitlements,
  getProductsFromEntitlement,
  listOfferings,
  listPackages,
  listAppPublicApiKeys,
} from "@replit/revenuecat-sdk";

async function main() {
  const client = await getUncachableRevenueCatClient();
  let projectId = process.env.REVENUECAT_PROJECT_ID;
  if (!projectId) {
    const { listProjects } = await import("@replit/revenuecat-sdk");
    const { data: projs } = await listProjects({ client });
    projectId = projs?.items?.[0]?.id;
    console.log("PROJECT:", projectId, projs?.items?.[0]?.name);
  }
  if (!projectId) throw new Error("no project found");

  const { data: apps, error: appsErr } = await listApps({ client, path: { project_id: projectId } });
  if (appsErr || !apps) throw new Error("listApps failed: " + JSON.stringify(appsErr));
  for (const a of apps.items) console.log("APP:", a.type, a.id, a.name, JSON.stringify((a as any).play_store ?? {}));

  const play = apps.items.find((a) => a.type === "play_store");

  const { data: products } = await listProducts({ client, path: { project_id: projectId }, query: { limit: 100 } });
  for (const p of products?.items ?? []) console.log("PRODUCT:", p.app_id === play?.id ? "[PLAY]" : "", p.id, p.store_identifier, p.display_name, p.type);

  const { data: ents } = await listEntitlements({ client, path: { project_id: projectId } });
  for (const e of ents?.items ?? []) {
    console.log("ENTITLEMENT:", e.lookup_key, e.id);
    const { data: eps } = await getProductsFromEntitlement({ client, path: { project_id: projectId, entitlement_id: e.id }, query: { limit: 100 } });
    for (const p of eps?.items ?? []) console.log("  ->", p.store_identifier, p.app_id === play?.id ? "[PLAY]" : "");
  }

  const { data: offs } = await listOfferings({ client, path: { project_id: projectId } });
  for (const o of offs?.items ?? []) {
    console.log("OFFERING:", o.lookup_key, "current:", o.is_current);
    const { data: pkgs } = await listPackages({ client, path: { project_id: projectId, offering_id: o.id }, query: { expand: ["items.product"] } });
    for (const pk of pkgs?.items ?? []) {
      const prods = (pk as any).products?.items?.map((x: any) => x.product?.store_identifier + (x.product?.app_id === play?.id ? "[PLAY]" : "")) ?? [];
      console.log("  PKG:", pk.lookup_key, prods.join(", "));
    }
  }

  if (play) {
    const { data: keys, error: kerr } = await listAppPublicApiKeys({ client, path: { project_id: projectId, app_id: play.id } });
    if (kerr) console.log("play keys error:", JSON.stringify(kerr));
    for (const k of keys?.items ?? []) console.log("PLAY PUBLIC KEY:", k.key);
  } else {
    console.log("NO PLAY STORE APP");
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
