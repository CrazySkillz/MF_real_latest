/** MimoSaaS brand colors — from Marketing Analytics Overview (orange PDF) */

export const MIMOSAAS_COLORS = {
  bgMain: "#fff8f3",
  bgCard: "#ffffff",
  bgHero: "#fff4e5",
  textMain: "#241306",
  textSubtle: "#8b7357",
  accent: "#ea580c",
  accentSoft: "rgba(234, 88, 12, 0.14)",
  borderSoft: "#fed7aa",
} as const;

export const MIMOSAAS_NAV = [
  { href: "#integrations", label: "Integrations" },
] as const;

export const WORKFLOW_STEPS = [
  {
    step: "1",
    title: "Connect your stack",
    description: "Link Meta, Google Ads, LinkedIn, GA4, and your CRM in a few clicks.",
  },
  {
    step: "2",
    title: "Set up client workspaces",
    description: "Create a workspace per account, map campaigns, and invite your team.",
  },
  {
    step: "3",
    title: "Deliver insights that win retainers",
    description: "Share live dashboards, scheduled reports, and proactive alerts with clients.",
  },
] as const;

export const INTEGRATIONS = [
  "Meta Ads",
  "Google Ads",
  "LinkedIn Ads",
  "TikTok",
  "Google Analytics 4",
  "Google Sheets",
  "Shopify",
  "Salesforce",
  "HubSpot",
] as const;
