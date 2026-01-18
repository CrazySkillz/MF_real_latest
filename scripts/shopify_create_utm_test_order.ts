/**
 * Create a Shopify test product + test order with UTM tags stored on the ORDER (industry standard).
 *
 * Why: MetricMind currently discovers Shopify attribution values from orders by parsing
 * `landing_site` / `landing_site_ref` UTMs (and we also write note_attributes as a common pattern).
 *
 * Required env vars (do NOT commit secrets):
 * - SHOPIFY_SHOP_DOMAIN   e.g. "your-store.myshopify.com" (or "your-store")
 * - SHOPIFY_ADMIN_TOKEN   Shopify Admin API access token (must include write_products + write_orders)
 *
 * Optional:
 * - SHOPIFY_API_VERSION   default "2024-01"
 * - UTM_CAMPAIGN / UTM_SOURCE / UTM_MEDIUM / UTM_CONTENT
 */
import process from "node:process";

const apiVersion = (process.env.SHOPIFY_API_VERSION || "2024-01").trim();

function normalizeDomain(input: string): string {
  let d = String(input || "").trim();
  d = d.replace(/^https?:\/\//i, "").split("/")[0].trim().toLowerCase();
  if (d && !d.includes(".")) d = `${d}.myshopify.com`;
  return d;
}

function requireEnv(name: string): string {
  const v = String(process.env[name] || "").trim();
  if (!v) {
    console.error(`Missing env var ${name}.`);
    process.exit(2);
  }
  return v;
}

async function shopifyFetch(shopDomain: string, token: string, path: string, init?: RequestInit) {
  const url = `https://${shopDomain}${path.startsWith("/") ? "" : "/"}${path}`;
  const resp = await fetch(url, {
    ...(init || {}),
    headers: {
      "X-Shopify-Access-Token": token,
      "Content-Type": "application/json",
      ...(init?.headers || {}),
    },
  });
  const text = await resp.text().catch(() => "");
  let json: any = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = null;
  }
  if (!resp.ok) {
    const msg =
      (json && (json.errors || json.error || json.message)) ||
      (text && text.length < 500 ? text : "") ||
      `HTTP ${resp.status}`;
    throw new Error(`Shopify API error ${resp.status}: ${String(msg)}`);
  }
  return json;
}

async function getAccessScopes(shopDomain: string, token: string): Promise<string[]> {
  const json = await shopifyFetch(shopDomain, token, `/admin/api/${apiVersion}/oauth/access_scopes.json`);
  const scopes = Array.isArray(json?.access_scopes) ? json.access_scopes : [];
  return scopes.map((s: any) => String(s?.handle || "")).filter(Boolean);
}

async function main() {
  const shopDomain = normalizeDomain(requireEnv("SHOPIFY_SHOP_DOMAIN"));
  const token = requireEnv("SHOPIFY_ADMIN_TOKEN");

  const utmCampaign = (process.env.UTM_CAMPAIGN || `li_test_campaign_${Date.now()}`).trim();
  const utmSource = (process.env.UTM_SOURCE || "linkedin").trim();
  const utmMedium = (process.env.UTM_MEDIUM || "paid").trim();
  const utmContent = (process.env.UTM_CONTENT || "ad_variant_a").trim();

  console.log(`Shop: ${shopDomain}`);
  console.log(`API version: ${apiVersion}`);

  // Validate scopes early (enterprise-grade diagnostics).
  const scopes = await getAccessScopes(shopDomain, token).catch((e) => {
    console.warn(`⚠️  Could not read access scopes: ${(e as any)?.message || e}`);
    return [] as string[];
  });
  if (scopes.length > 0) {
    const need = ["write_products", "write_orders"];
    const missing = need.filter((s) => !scopes.includes(s));
    if (missing.length > 0) {
      throw new Error(`Token is missing required scopes: ${missing.join(", ")}. Current scopes: ${scopes.join(", ")}`);
    }
  } else {
    console.warn("⚠️  Proceeding without scope validation (access_scopes endpoint unavailable).");
  }

  // 1) Create product
  const productTitle = `MetricMind UTM Test Product (${utmCampaign})`;
  const productPayload = {
    product: {
      title: productTitle,
      body_html: `<p>Created by MetricMind test script. UTM campaign: <strong>${utmCampaign}</strong></p>`,
      vendor: "MetricMind",
      product_type: "Test",
      status: "active",
      variants: [{ price: "9.99", sku: `MM-UTM-${Date.now()}` }],
    },
  };
  const createdProduct = await shopifyFetch(
    shopDomain,
    token,
    `/admin/api/${apiVersion}/products.json`,
    { method: "POST", body: JSON.stringify(productPayload) }
  );
  const product = createdProduct?.product;
  const variantId = product?.variants?.[0]?.id;
  if (!product?.id || !variantId) throw new Error("Failed to create product/variant");

  console.log(`✅ Created product: ${product.title} (product_id=${product.id}, variant_id=${variantId})`);

  // 2) Create test order with UTMs on landing_site and note_attributes
  const landingSite = `/?utm_source=${encodeURIComponent(utmSource)}&utm_medium=${encodeURIComponent(utmMedium)}&utm_campaign=${encodeURIComponent(utmCampaign)}&utm_content=${encodeURIComponent(utmContent)}`;
  const orderPayload: any = {
    order: {
      test: true,
      financial_status: "paid",
      fulfillment_status: null,
      currency: "GBP",
      landing_site: landingSite,
      note_attributes: [
        { name: "utm_source", value: utmSource },
        { name: "utm_medium", value: utmMedium },
        { name: "utm_campaign", value: utmCampaign },
        { name: "utm_content", value: utmContent },
      ],
      line_items: [{ variant_id: variantId, quantity: 1 }],
      customer: { first_name: "MetricMind", last_name: "Test", email: `metricmind.test+${Date.now()}@example.com` },
    },
  };

  const createdOrder = await shopifyFetch(
    shopDomain,
    token,
    `/admin/api/${apiVersion}/orders.json`,
    { method: "POST", body: JSON.stringify(orderPayload) }
  );
  const order = createdOrder?.order;
  if (!order?.id) throw new Error("Failed to create order");

  console.log(`✅ Created test order: order_id=${order.id} order_number=${order.order_number ?? "n/a"}`);
  console.log("");
  console.log("Use this to validate MetricMind:");
  console.log(`- Attribution key: UTM Campaign`);
  console.log(`- Expected value in crosswalk list: ${utmCampaign}`);
  console.log("");
  console.log("FYI: UTMs were written to:");
  console.log(`- order.landing_site = ${landingSite}`);
  console.log(`- order.note_attributes = utm_* key/value pairs`);
}

main().catch((e) => {
  console.error(`❌ Failed: ${(e as any)?.message || e}`);
  process.exit(1);
});


