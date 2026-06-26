// Seed script: provisions the Earnings Ninja RevenueCat project, apps, products,
// entitlement, offering and packages. Run manually (NOT from the API server):
//   npx tsx scripts/seedRevenueCat.ts
// Idempotent — safe to re-run. It reuses any entity that already exists.
import { getUncachableRevenueCatClient } from "./revenueCatClient";

import {
  listProjects,
  createProject,
  listApps,
  createApp,
  listAppPublicApiKeys,
  listProducts,
  createProduct,
  listEntitlements,
  createEntitlement,
  attachProductsToEntitlement,
  listOfferings,
  createOffering,
  updateOffering,
  listPackages,
  createPackages,
  attachProductsToPackage,
  type App,
  type Product,
  type Project,
  type Entitlement,
  type Offering,
  type Package,
  type CreateProductData,
} from "@replit/revenuecat-sdk";

const PROJECT_NAME = "Earnings Ninja";

const APP_STORE_APP_NAME = "Earnings Ninja (iOS)";
const APP_STORE_BUNDLE_ID = "com.earningsninja.app";
const PLAY_STORE_APP_NAME = "Earnings Ninja (Android)";
const PLAY_STORE_PACKAGE_NAME = "com.earningsninja.app";

const ENTITLEMENT_IDENTIFIER = "pro"; // unlocks CSV export + advanced analytics
const ENTITLEMENT_DISPLAY_NAME = "Earnings Ninja Pro";

const OFFERING_IDENTIFIER = "default";
const OFFERING_DISPLAY_NAME = "Default Offering";

type PlanConfig = {
  storeIdentifier: string;       // App Store / Test Store product id
  playStoreIdentifier: string;   // Play Store {subscriptionId}:{basePlanId}
  displayName: string;
  userFacingTitle: string;
  productType: "subscription" | "non_consumable";
  duration?: "P1W" | "P1M" | "P2M" | "P3M" | "P6M" | "P1Y";
  packageIdentifier: string;     // RevenueCat package lookup key
  packageDisplayName: string;
  prices: { amount_micros: number; currency: string }[];
};

const PLANS: PlanConfig[] = [
  {
    storeIdentifier: "pro_lifetime",
    playStoreIdentifier: "pro_lifetime",
    displayName: "Pro Lifetime",
    userFacingTitle: "Earnings Ninja Pro (Lifetime)",
    productType: "non_consumable",
    packageIdentifier: "$rc_lifetime",
    packageDisplayName: "Lifetime",
    prices: [{ amount_micros: 79_990_000, currency: "USD" }], // $79.99
  },
  {
    storeIdentifier: "pro_yearly",
    playStoreIdentifier: "pro_yearly:yearly",
    displayName: "Pro Yearly",
    userFacingTitle: "Earnings Ninja Pro (Yearly)",
    productType: "subscription",
    duration: "P1Y",
    packageIdentifier: "$rc_annual",
    packageDisplayName: "Annual",
    prices: [{ amount_micros: 29_990_000, currency: "USD" }], // $29.99
  },
  {
    storeIdentifier: "pro_monthly",
    playStoreIdentifier: "pro_monthly:monthly",
    displayName: "Pro Monthly",
    userFacingTitle: "Earnings Ninja Pro (Monthly)",
    productType: "subscription",
    duration: "P1M",
    packageIdentifier: "$rc_monthly",
    packageDisplayName: "Monthly",
    prices: [{ amount_micros: 4_990_000, currency: "USD" }], // $4.99
  },
];

type TestStorePricesResponse = {
  object: string;
  prices: { amount_micros: number; currency: string }[];
};

async function seedRevenueCat() {
  const client = await getUncachableRevenueCatClient();

  // --- Project ---
  let project: Project;
  const { data: existingProjects, error: listProjectsError } = await listProjects({
    client,
    query: { limit: 20 },
  });
  if (listProjectsError) throw new Error("Failed to list projects");

  const existingProject = existingProjects.items?.find((p) => p.name === PROJECT_NAME);
  if (existingProject) {
    console.log("Project already exists:", existingProject.id);
    project = existingProject;
  } else {
    const { data: newProject, error } = await createProject({
      client,
      body: { name: PROJECT_NAME },
    });
    if (error) throw new Error("Failed to create project");
    console.log("Created project:", newProject.id);
    project = newProject;
  }

  // --- Apps ---
  const { data: apps, error: listAppsError } = await listApps({
    client,
    path: { project_id: project.id },
    query: { limit: 20 },
  });
  if (listAppsError || !apps || apps.items.length === 0) {
    throw new Error("No apps found");
  }

  let app: App | undefined = apps.items.find((a) => a.type === "test_store");
  let appStoreApp: App | undefined = apps.items.find((a) => a.type === "app_store");
  let playStoreApp: App | undefined = apps.items.find((a) => a.type === "play_store");

  if (!app) throw new Error("No app with test store found");
  console.log("Test store app:", app.id);

  if (!appStoreApp) {
    const { data: newApp, error } = await createApp({
      client,
      path: { project_id: project.id },
      body: {
        name: APP_STORE_APP_NAME,
        type: "app_store",
        app_store: { bundle_id: APP_STORE_BUNDLE_ID },
      },
    });
    if (error) throw new Error("Failed to create App Store app");
    appStoreApp = newApp;
    console.log("Created App Store app:", appStoreApp.id);
  } else {
    console.log("App Store app:", appStoreApp.id);
  }

  if (!playStoreApp) {
    const { data: newApp, error } = await createApp({
      client,
      path: { project_id: project.id },
      body: {
        name: PLAY_STORE_APP_NAME,
        type: "play_store",
        play_store: { package_name: PLAY_STORE_PACKAGE_NAME },
      },
    });
    if (error) throw new Error("Failed to create Play Store app");
    playStoreApp = newApp;
    console.log("Created Play Store app:", playStoreApp.id);
  } else {
    console.log("Play Store app:", playStoreApp.id);
  }

  // --- Products ---
  const { data: existingProducts, error: listProductsError } = await listProducts({
    client,
    path: { project_id: project.id },
    query: { limit: 100 },
  });
  if (listProductsError) throw new Error("Failed to list products");

  const ensureProductForApp = async (
    targetApp: App,
    label: string,
    productIdentifier: string,
    plan: PlanConfig,
    isTestStore: boolean,
  ): Promise<Product> => {
    const existing = existingProducts.items?.find(
      (p) => p.store_identifier === productIdentifier && p.app_id === targetApp.id,
    );
    if (existing) {
      console.log(`${label} product already exists:`, existing.id);
      return existing;
    }

    const body: CreateProductData["body"] = {
      store_identifier: productIdentifier,
      app_id: targetApp.id,
      type: plan.productType,
      display_name: plan.displayName,
    };
    if (isTestStore) {
      body.title = plan.userFacingTitle;
      if (plan.productType === "subscription" && plan.duration) {
        body.subscription = { duration: plan.duration };
      }
    }

    const { data: created, error } = await createProduct({
      client,
      path: { project_id: project.id },
      body,
    });
    if (error) throw new Error(`Failed to create ${label} product`);
    console.log(`Created ${label} product:`, created.id);
    return created;
  };

  const allEntitlementProductIds: string[] = [];
  type SeededPlan = { plan: PlanConfig; testProduct: Product; appProduct: Product; playProduct: Product };
  const seededPlans: SeededPlan[] = [];

  for (const plan of PLANS) {
    const testProduct = await ensureProductForApp(app, `Test Store (${plan.packageDisplayName})`, plan.storeIdentifier, plan, true);
    const appProduct = await ensureProductForApp(appStoreApp, `App Store (${plan.packageDisplayName})`, plan.storeIdentifier, plan, false);
    const playProduct = await ensureProductForApp(playStoreApp, `Play Store (${plan.packageDisplayName})`, plan.playStoreIdentifier, plan, false);

    // Test store prices (undocumented endpoint).
    const { error: priceError } = await client.post<TestStorePricesResponse>({
      url: "/projects/{project_id}/products/{product_id}/test_store_prices",
      path: { project_id: project.id, product_id: testProduct.id },
      body: { prices: plan.prices },
    });
    if (priceError) {
      if (typeof priceError === "object" && priceError && "type" in priceError && (priceError as any).type === "resource_already_exists") {
        console.log(`Test store prices already exist for ${plan.packageDisplayName}`);
      } else {
        throw new Error(`Failed to add test store prices for ${plan.packageDisplayName}`);
      }
    } else {
      console.log(`Added test store prices for ${plan.packageDisplayName}`);
    }

    allEntitlementProductIds.push(testProduct.id, appProduct.id, playProduct.id);
    seededPlans.push({ plan, testProduct, appProduct, playProduct });
  }

  // --- Entitlement ---
  let entitlement: Entitlement;
  const { data: existingEntitlements, error: listEntitlementsError } = await listEntitlements({
    client,
    path: { project_id: project.id },
    query: { limit: 20 },
  });
  if (listEntitlementsError) throw new Error("Failed to list entitlements");

  const existingEntitlement = existingEntitlements.items?.find((e) => e.lookup_key === ENTITLEMENT_IDENTIFIER);
  if (existingEntitlement) {
    console.log("Entitlement already exists:", existingEntitlement.id);
    entitlement = existingEntitlement;
  } else {
    const { data: newEntitlement, error } = await createEntitlement({
      client,
      path: { project_id: project.id },
      body: { lookup_key: ENTITLEMENT_IDENTIFIER, display_name: ENTITLEMENT_DISPLAY_NAME },
    });
    if (error) throw new Error("Failed to create entitlement");
    console.log("Created entitlement:", newEntitlement.id);
    entitlement = newEntitlement;
  }

  const { error: attachEntitlementError } = await attachProductsToEntitlement({
    client,
    path: { project_id: project.id, entitlement_id: entitlement.id },
    body: { product_ids: allEntitlementProductIds },
  });
  if (attachEntitlementError) {
    if (attachEntitlementError.type === "unprocessable_entity_error") {
      console.log("Products already attached to entitlement");
    } else {
      throw new Error("Failed to attach products to entitlement");
    }
  } else {
    console.log("Attached products to entitlement");
  }

  // --- Offering ---
  let offering: Offering;
  const { data: existingOfferings, error: listOfferingsError } = await listOfferings({
    client,
    path: { project_id: project.id },
    query: { limit: 20 },
  });
  if (listOfferingsError) throw new Error("Failed to list offerings");

  const existingOffering = existingOfferings.items?.find((o) => o.lookup_key === OFFERING_IDENTIFIER);
  if (existingOffering) {
    console.log("Offering already exists:", existingOffering.id);
    offering = existingOffering;
  } else {
    const { data: newOffering, error } = await createOffering({
      client,
      path: { project_id: project.id },
      body: { lookup_key: OFFERING_IDENTIFIER, display_name: OFFERING_DISPLAY_NAME },
    });
    if (error) throw new Error("Failed to create offering");
    console.log("Created offering:", newOffering.id);
    offering = newOffering;
  }

  if (!offering.is_current) {
    const { error } = await updateOffering({
      client,
      path: { project_id: project.id, offering_id: offering.id },
      body: { is_current: true },
    });
    if (error) throw new Error("Failed to set offering as current");
    console.log("Set offering as current");
  }

  // --- Packages (one per plan) ---
  const { data: existingPackages, error: listPackagesError } = await listPackages({
    client,
    path: { project_id: project.id, offering_id: offering.id },
    query: { limit: 20 },
  });
  if (listPackagesError) throw new Error("Failed to list packages");

  for (const { plan, testProduct, appProduct, playProduct } of seededPlans) {
    let pkg: Package | undefined = existingPackages.items?.find((p) => p.lookup_key === plan.packageIdentifier);
    if (pkg) {
      console.log(`Package ${plan.packageIdentifier} already exists:`, pkg.id);
    } else {
      const { data: newPackage, error } = await createPackages({
        client,
        path: { project_id: project.id, offering_id: offering.id },
        body: { lookup_key: plan.packageIdentifier, display_name: plan.packageDisplayName },
      });
      if (error) throw new Error(`Failed to create package ${plan.packageIdentifier}`);
      console.log(`Created package ${plan.packageIdentifier}:`, newPackage.id);
      pkg = newPackage;
    }

    const { error: attachPackageError } = await attachProductsToPackage({
      client,
      path: { project_id: project.id, package_id: pkg.id },
      body: {
        products: [
          { product_id: testProduct.id, eligibility_criteria: "all" },
          { product_id: appProduct.id, eligibility_criteria: "all" },
          { product_id: playProduct.id, eligibility_criteria: "all" },
        ],
      },
    });
    if (attachPackageError) {
      if (attachPackageError.type === "unprocessable_entity_error" && attachPackageError.message?.includes("Cannot attach product")) {
        console.log(`Skipping package attach for ${plan.packageIdentifier}: incompatible product already attached`);
      } else {
        throw new Error(`Failed to attach products to package ${plan.packageIdentifier}`);
      }
    } else {
      console.log(`Attached products to package ${plan.packageIdentifier}`);
    }
  }

  // --- Public API keys ---
  const { data: testStoreApiKeys, error: testStoreApiKeysError } = await listAppPublicApiKeys({
    client,
    path: { project_id: project.id, app_id: app.id },
  });
  if (testStoreApiKeysError) throw new Error("Failed to list public API keys for Test Store app");

  const { data: appStoreApiKeys, error: appStoreApiKeysError } = await listAppPublicApiKeys({
    client,
    path: { project_id: project.id, app_id: appStoreApp.id },
  });
  if (appStoreApiKeysError) throw new Error("Failed to list public API keys for App Store app");

  const { data: playStoreApiKeys, error: playStoreApiKeysError } = await listAppPublicApiKeys({
    client,
    path: { project_id: project.id, app_id: playStoreApp.id },
  });
  if (playStoreApiKeysError) throw new Error("Failed to list public API keys for Play Store app");

  console.log("\n====================");
  console.log("RevenueCat setup complete!");
  console.log("REVENUECAT_PROJECT_ID:", project.id);
  console.log("REVENUECAT_TEST_STORE_APP_ID:", app.id);
  console.log("REVENUECAT_APPLE_APP_STORE_APP_ID:", appStoreApp.id);
  console.log("REVENUECAT_GOOGLE_PLAY_STORE_APP_ID:", playStoreApp.id);
  console.log("Entitlement Identifier:", ENTITLEMENT_IDENTIFIER);
  console.log("EXPO_PUBLIC_REVENUECAT_TEST_API_KEY:", testStoreApiKeys?.items.map((i) => i.key).join(", ") ?? "N/A");
  console.log("EXPO_PUBLIC_REVENUECAT_IOS_API_KEY:", appStoreApiKeys?.items.map((i) => i.key).join(", ") ?? "N/A");
  console.log("EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY:", playStoreApiKeys?.items.map((i) => i.key).join(", ") ?? "N/A");
  console.log("====================\n");
}

seedRevenueCat().catch((err) => {
  console.error(err);
  process.exit(1);
});
