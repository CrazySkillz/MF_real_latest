const fs = require('fs');
const path = require('path');

// Seed for reproducible "random" data
let seed = 42;
function rand() {
  seed = (seed * 16807 + 0) % 2147483647;
  return seed / 2147483647;
}
function randBetween(min, max) { return min + rand() * (max - min); }
function randInt(min, max) { return Math.floor(randBetween(min, max + 1)); }

// --- Campaign definitions with realistic baseline metrics ---
const campaigns = [
  {
    name: "Spring Sale 2026 – Search",
    channel: "Google Ads",
    type: "Search",
    baseImpressions: [4500, 7500],
    baseCTR: [0.04, 0.08],
    baseCPC: [1.20, 2.80],
    convRate: [0.04, 0.08],
    avgOrderValue: [65, 140],
    weekendDip: 0.55,
  },
  {
    name: "Spring Sale 2026 – Display",
    channel: "Google Ads",
    type: "Display",
    baseImpressions: [30000, 55000],
    baseCTR: [0.003, 0.008],
    baseCPC: [0.35, 0.75],
    convRate: [0.008, 0.02],
    avgOrderValue: [45, 95],
    weekendDip: 0.70,
  },
  {
    name: "Brand Awareness – Feed Ads",
    channel: "Meta (Facebook)",
    type: "Paid Social",
    baseImpressions: [18000, 35000],
    baseCTR: [0.01, 0.025],
    baseCPC: [0.50, 1.10],
    convRate: [0.015, 0.035],
    avgOrderValue: [55, 110],
    weekendDip: 0.90,
  },
  {
    name: "Brand Awareness – Stories",
    channel: "Meta (Instagram)",
    type: "Paid Social",
    baseImpressions: [12000, 25000],
    baseCTR: [0.008, 0.018],
    baseCPC: [0.40, 0.90],
    convRate: [0.01, 0.025],
    avgOrderValue: [50, 100],
    weekendDip: 0.95,
  },
  {
    name: "B2B Lead Gen – Sponsored Content",
    channel: "LinkedIn",
    type: "Paid Social",
    baseImpressions: [5000, 12000],
    baseCTR: [0.005, 0.012],
    baseCPC: [5.50, 12.00],
    convRate: [0.03, 0.07],
    avgOrderValue: [0, 0], // lead gen, no direct revenue
    weekendDip: 0.25,
    isLeadGen: true,
    costPerLead: [35, 85],
  },
  {
    name: "Product Launch – Video Ads",
    channel: "TikTok",
    type: "Paid Social",
    baseImpressions: [40000, 80000],
    baseCTR: [0.006, 0.015],
    baseCPC: [0.20, 0.55],
    convRate: [0.005, 0.015],
    avgOrderValue: [30, 75],
    weekendDip: 1.10, // actually higher on weekends
  },
  {
    name: "Retargeting – Dynamic Product Ads",
    channel: "Meta (Facebook)",
    type: "Retargeting",
    baseImpressions: [8000, 15000],
    baseCTR: [0.02, 0.045],
    baseCPC: [0.60, 1.40],
    convRate: [0.05, 0.12],
    avgOrderValue: [70, 160],
    weekendDip: 0.80,
  },
  {
    name: "Email Nurture – Weekly Newsletter",
    channel: "Email",
    type: "Email",
    baseImpressions: [12000, 12000], // list size, consistent
    baseCTR: [0.015, 0.035],
    baseCPC: [0, 0], // no CPC
    convRate: [0.02, 0.05],
    avgOrderValue: [55, 120],
    weekendDip: 0.40,
    isEmail: true,
    openRate: [0.18, 0.28],
    sends: [12000, 12500],
  },
];

// --- Generate daily data for Feb 2026 ---
const startDate = new Date(2026, 1, 1); // Feb 1, 2026
const days = 28;

const rows = [];
// Add a slight upward trend over the month (campaigns ramping up)
for (let d = 0; d < days; d++) {
  const date = new Date(startDate);
  date.setDate(date.getDate() + d);
  const dateStr = `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
  const dayOfWeek = date.getDay(); // 0=Sun, 6=Sat
  const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
  const trendMultiplier = 1 + (d / days) * 0.15; // 15% ramp over month

  for (const c of campaigns) {
    const weekendMult = isWeekend ? c.weekendDip : 1.0;

    let impressions, clicks, ctr, cpc, spend, conversions, convRate, revenue, roas;

    impressions = Math.round(randBetween(...c.baseImpressions) * weekendMult * trendMultiplier);

    if (c.isEmail) {
      // Email: sends, opens (impressions), clicks, conversions
      const sends = randInt(...c.sends);
      const openRate = randBetween(...c.openRate);
      const opens = Math.round(sends * openRate * weekendMult);
      impressions = sends; // "Impressions" = sends for email
      clicks = Math.round(opens * randBetween(...c.baseCTR));
      ctr = clicks / impressions;
      cpc = 0;
      spend = randBetween(15, 35); // email platform cost
      convRate = randBetween(...c.convRate);
      conversions = Math.max(0, Math.round(clicks * convRate));
      revenue = conversions * randBetween(...c.avgOrderValue);
      roas = spend > 0 ? revenue / spend : 0;
    } else {
      ctr = randBetween(...c.baseCTR);
      clicks = Math.max(1, Math.round(impressions * ctr));
      ctr = clicks / impressions; // recalc

      if (c.baseCPC[1] === 0) {
        cpc = 0;
        spend = 0;
      } else {
        cpc = randBetween(...c.baseCPC);
        spend = clicks * cpc;
      }

      convRate = randBetween(...c.convRate);
      conversions = Math.max(0, Math.round(clicks * convRate));

      if (c.isLeadGen) {
        revenue = 0; // leads, not direct revenue
      } else {
        revenue = conversions * randBetween(...c.avgOrderValue);
      }
      roas = spend > 0 ? revenue / spend : 0;
    }

    rows.push({
      Date: dateStr,
      Campaign: c.name,
      Channel: c.channel,
      "Campaign Type": c.type,
      Impressions: impressions,
      Clicks: clicks,
      "CTR (%)": (ctr * 100).toFixed(2),
      "Avg CPC ($)": cpc.toFixed(2),
      "Spend ($)": spend.toFixed(2),
      Conversions: conversions,
      "Conv Rate (%)": (convRate * 100).toFixed(2),
      "Cost/Conv ($)": conversions > 0 ? (spend / conversions).toFixed(2) : "–",
      "Revenue ($)": revenue.toFixed(2),
      ROAS: roas.toFixed(2),
    });
  }
}

// --- Tab 2: Lead Pipeline (B2B campaigns only, weekly) ---
const pipelineRows = [];
const b2bCampaigns = [
  { name: "B2B Lead Gen – Sponsored Content", channel: "LinkedIn" },
  { name: "Brand Awareness – Feed Ads", channel: "Meta (Facebook)" },
  { name: "Email Nurture – Weekly Newsletter", channel: "Email" },
];

for (let w = 0; w < 4; w++) {
  const weekStart = new Date(startDate);
  weekStart.setDate(weekStart.getDate() + w * 7);
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 6);
  const fmt = (dt) => `${dt.getFullYear()}-${String(dt.getMonth()+1).padStart(2,'0')}-${String(dt.getDate()).padStart(2,'0')}`;
  const weekLabel = `${fmt(weekStart)} – ${fmt(weekEnd)}`;

  for (const c of b2bCampaigns) {
    const leads = randInt(25, 80);
    const mqlRate = randBetween(0.30, 0.55);
    const mqls = Math.round(leads * mqlRate);
    const sqlRate = randBetween(0.25, 0.45);
    const sqls = Math.round(mqls * sqlRate);
    const oppRate = randBetween(0.30, 0.55);
    const opps = Math.round(sqls * oppRate);
    const closeRate = randBetween(0.15, 0.35);
    const closedWon = Math.round(opps * closeRate);
    const avgDealSize = randBetween(3500, 12000);
    const pipelineValue = opps * avgDealSize;
    const closedRevenue = closedWon * avgDealSize;

    pipelineRows.push({
      "Week": weekLabel,
      "Campaign": c.name,
      "Channel": c.channel,
      "Leads": leads,
      "MQLs": mqls,
      "SQLs": sqls,
      "Opportunities": opps,
      "Closed Won": closedWon,
      "Pipeline Value ($)": pipelineValue.toFixed(2),
      "Closed Revenue ($)": closedRevenue.toFixed(2),
      "Lead→MQL (%)": (mqlRate * 100).toFixed(1),
      "MQL→SQL (%)": (sqlRate * 100).toFixed(1),
      "SQL→Close (%)": (closeRate * 100).toFixed(1),
    });
  }
}

// --- Tab 3: Monthly Budget Tracker ---
const budgetRows = [];
const budgetData = [
  { channel: "Google Ads", budget: 22000, allocated: { Search: 0.60, Display: 0.40 } },
  { channel: "Meta (Facebook)", budget: 20000, allocated: { "Feed Ads": 0.50, "Retargeting": 0.50 } },
  { channel: "Meta (Instagram)", budget: 4500, allocated: { Stories: 1.0 } },
  { channel: "LinkedIn", budget: 14000, allocated: { "Sponsored Content": 1.0 } },
  { channel: "TikTok", budget: 8000, allocated: { "Video Ads": 1.0 } },
  { channel: "Email", budget: 700, allocated: { Newsletter: 1.0 } },
];

// Calculate actual spend from Tab 1
const spendByChannel = {};
for (const row of rows) {
  const key = row.Channel;
  spendByChannel[key] = (spendByChannel[key] || 0) + parseFloat(row["Spend ($)"]);
}

for (const b of budgetData) {
  const actualSpend = spendByChannel[b.channel] || 0;
  const pacing = (actualSpend / b.budget) * 100;
  const daysElapsed = days;
  const expectedPacing = (daysElapsed / 28) * 100;
  const pacingStatus = pacing > expectedPacing + 5 ? "Over-pacing" : pacing < expectedPacing - 5 ? "Under-pacing" : "On Track";

  budgetRows.push({
    "Channel": b.channel,
    "Monthly Budget ($)": b.budget.toFixed(2),
    "Spend to Date ($)": actualSpend.toFixed(2),
    "Remaining ($)": (b.budget - actualSpend).toFixed(2),
    "Budget Used (%)": pacing.toFixed(1),
    "Pacing Status": pacingStatus,
    "Days Elapsed": daysElapsed,
    "Days in Month": 28,
  });
}

// --- Write CSVs ---
function toCsv(data) {
  if (data.length === 0) return '';
  const headers = Object.keys(data[0]);
  const lines = [headers.join(',')];
  for (const row of data) {
    lines.push(headers.map(h => {
      const val = String(row[h]);
      return val.includes(',') || val.includes('"') || val.includes('–')
        ? `"${val.replace(/"/g, '""')}"`
        : val;
    }).join(','));
  }
  return lines.join('\n');
}

const outDir = path.join(__dirname);
fs.writeFileSync(path.join(outDir, 'Tab1_Campaign_Performance.csv'), toCsv(rows));
fs.writeFileSync(path.join(outDir, 'Tab2_Lead_Pipeline.csv'), toCsv(pipelineRows));
fs.writeFileSync(path.join(outDir, 'Tab3_Budget_Tracker.csv'), toCsv(budgetRows));

console.log(`Generated ${rows.length} rows in Tab1_Campaign_Performance.csv`);
console.log(`Generated ${pipelineRows.length} rows in Tab2_Lead_Pipeline.csv`);
console.log(`Generated ${budgetRows.length} rows in Tab3_Budget_Tracker.csv`);
console.log(`\nFiles saved to: ${outDir}`);
