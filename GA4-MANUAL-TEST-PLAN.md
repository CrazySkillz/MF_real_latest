# GA4 Manual Test Plan — User Journeys

## How This Plan Works
Each journey follows the exact steps a user would take, in order. Start with Journey 1 and work through sequentially. Each journey builds on the state left by the previous one.

## Two Data Sources Explained
The mock system has two separate data sources — understanding this is key to validating numbers:

**1. Simulation (instant, on page load)**
When you connect a mock GA4 property with yesop_brand_search + yesop_prospecting selected, you choose a **lookback window** (30 / 60 / 90 days, default 90). The `ga4-to-date` and `ga4-breakdown` endpoints return simulated totals for that window using a scale formula:
- brand_search scale = 1.0, prospecting scale = 0.6 → combined scale = 1.6
- Base values depend on lookback window chosen. For **90 days** (default):
  - Sessions = 41,000 × 1.6 = **65,600**
  - Revenue = $150,220.15 × 1.6 = **$240,352.24**
  - Conversions = 1,620 × 1.6 = **2,592**
  - Users = 31,800 × 1.6 = **50,880**
- For **30 days**: Sessions ≈ 22,520, Revenue ≈ $87,489, Conversions ≈ 885, Users ≈ 17,280
- For **60 days**: Sessions ≈ 45,040, Revenue ≈ $174,979, Conversions ≈ 1,770, Users ≈ 34,560
- **Spend = $0** (GA4 never imports spend — spend comes from ad platforms or manual entry)

**2. Run Refresh (manual button, adds 1 day per click)**
Simulates what happens in production when ALL daily schedulers run together:
- **GA4 scheduler** fetches daily metrics from Google Analytics API
- **Ad platform schedulers** (LinkedIn, Meta, Google Ads) fetch daily spend from each platform's API
- **Revenue** is included in GA4 metrics (ecommerce/purchase events)

In the mock system, each click uses fixed daily values from the two selected campaigns:

| Source | What it simulates | brand_search | prospecting | **Daily total** |
|--------|-------------------|-------------|-------------|----------------|
| GA4 scheduler | Sessions | 750 | 420 | **1,170** |
| GA4 scheduler | Conversions | 38 | 18 | **56** |
| GA4 scheduler | Revenue | $2,850 | $1,350 | **$4,200** |
| Ad platform schedulers | Spend | $950 | $680 | **$1,630** |

So after each Run Refresh click:
- Sessions increase by 1,170
- Conversions increase by 56
- Revenue increases by $4,200 (shows as "GA4 Revenue" source)
- Spend increases by $1,630 (shows as "Mock Spend" source — simulates ad platform scheduler imports)

After Run Refresh, the `ga4-to-date` and `ga4-daily` endpoints prefer real DB rows over simulation. So the Overview totals will shift from simulation values to accumulated Run Refresh values.

---

## Journey 1: Create Campaign + Connect GA4

### Step 1: Create a fresh campaign + connect GA4
- [ ] Open MimoSaaS in your browser
- [ ] In the left sidebar, find your client name (e.g., "Tally" or your test client)
- [ ] If no client exists: click the "+" button next to "Clients" header in sidebar → enter a client name → Save
- [ ] Click the client name in sidebar → you're taken to the Dashboard
- [ ] In sidebar, click "Campaigns" under your client (or navigate to `/campaigns`)
- [ ] Click **"New Campaign"** button

### Step 2: Wizard Step 1 — Campaign Details
- [ ] Enter campaign name: **"GA4 Test"**
- [ ] Leave other fields at defaults (or fill as desired)
- [ ] Click **Next** → draft campaign created, advances to Step 2

### Step 3: Wizard Step 2 — Select Platform
- [ ] You see a 2-column tile grid of platforms
- [ ] Click **"Google Analytics"** tile → advances to Step 3

### Step 4: Wizard Step 3 — Authenticate
- [ ] The IntegratedGA4Auth component appears (for real Google OAuth)
- [ ] Click **"Use test data instead"** link at the bottom
- [ ] Test mode UI appears with a **"Connect Test Property"** button
- [ ] Click **Connect Test Property** → automatically advances to Step 4 with mock "Yesop" property pre-selected

### Step 5: Wizard Step 4 — Configure GA4
- [ ] **GA4 property**: "Yesop Mock Property" is pre-selected from test mode
- [ ] **Select lookback window**: choose **90 days** (default) — three toggle buttons: 30 / 60 / 90 days
- [ ] Click **Connect Property**
- [ ] Property connects → campaign filter selection appears
- [ ] **Select mock campaigns**: check both **yesop_brand_search** AND **yesop_prospecting**
- [ ] Click **Save & Continue** → advances to Step 5

### Step 6: Wizard Step 5 — Confirm & Create
- [ ] Review summary: campaign name "GA4 Test", Google Analytics connected
- [ ] Click **Create Campaign**
- [ ] Redirected to campaigns list, "GA4 Test" appears

### Step 7: Navigate to GA4 Metrics
- [ ] Click on "GA4 Test" campaign → opens Campaign Detail page
- [ ] In the Campaign Detail page, find "Google Analytics" in the Connected Platforms section
- [ ] Click "View Detailed Analytics" (or the GA4 link in sidebar under the campaign)
- [ ] **6 tabs now visible**: Overview, KPIs, Benchmarks, Reports, Campaigns, Insights

### Step 8: Verify Overview tab — initial simulation data
- [ ] Click the **Overview** tab (should be selected by default)
- [ ] Values depend on the **lookback window** selected in Step 5:

| Metric | 30 days | 60 days | 90 days (default) |
|--------|---------|---------|-------------------|
| Sessions | ≈ 22,520 | ≈ 45,040 | ≈ 65,600 |
| Users | ≈ 17,280 | ≈ 34,560 | ≈ 50,880 |
| Conversions | ≈ 885 | ≈ 1,770 | ≈ 2,592 |
| Revenue | ≈ $87,489 | ≈ $174,979 | ≈ $240,352 |

- [ ] **If you chose 90 days**: Sessions ≈ 65,600, Users ≈ 50,880, Conversions ≈ 2,592, Revenue ≈ $240,352
- [ ] **Spend = $0.00** — "Add Spend" button visible (GA4 does NOT track spend)
- [ ] **"+" icon** visible on both Spend and Revenue cards
- [ ] **ROAS = N/A or $0** (cannot calculate without spend)
- [ ] **CPA = N/A** (cannot calculate without spend)
- [ ] **ROI = N/A** (cannot calculate without spend)

> **Production note**: In production, the lookback window controls how many days of real GA4 data the scheduler fetches on first sync. A 30-day window fetches less history than 90 days. The values above are mock simulation values — real production values depend on actual GA4 traffic.

### Step 9: Verify KPI template gates
- [ ] Click the **KPIs** tab
- [ ] Click the **Create KPI** button (orange button)
- [ ] Look at the template tiles:
  - **ENABLED** (full color, clickable): Sessions, Users, Conversions, Engagement Rate, CR, Revenue
  - **DISABLED** (grayed out, opacity-50, NOT clickable): ROAS, ROI, CPA
- [ ] Try clicking a disabled template → nothing happens
- [ ] Close the dialog (click Cancel or X)

### Step 10: Verify Benchmark template gates
- [ ] Click the **Benchmarks** tab
- [ ] Click **Create Benchmark** button
- [ ] Same pattern: Revenue ENABLED, ROAS/ROI/CPA DISABLED
- [ ] Close the dialog

### Step 11: Verify Insights tab
- [ ] Click the **Insights** tab
- [ ] Scroll to **Executive Financials** section: Revenue ≈ $240,352, Spend = $0
- [ ] Scroll to **Data Summary** section: Sessions/Conversions/CR/Revenue cards populated
- [ ] **Channel Breakdown table**: shows traffic channels from simulation
- [ ] Scroll to **What changed, what to do next** section:
  - Informational insights with blue **"Info"** badge (not "Low")
  - **"Spend missing"** integrity insight should appear (revenue exists but no spend)

### Step 12: Verify Ad Comparison tab
- [ ] Click the **Campaigns** tab (this is the Ad Comparison view)
- [ ] Campaign breakdown table visible with data from simulation

---

## Journey 2: Create Non-Financial KPIs & Benchmarks (No Spend Yet)

**State**: Metrics + revenue exist from simulation. Spend = $0. This is the default state after connecting GA4 — test it before adding spend.

### Step 1: Create Sessions KPI
- [ ] Click the **KPIs** tab → click **Create KPI**
- [ ] Select **"Total Sessions"** template → ENABLED (no spend needed)
- [ ] Current auto-populates (note the value — should match Overview sessions ≈ 65,600)
- [ ] Set Target = **100,000**
- [ ] Alert: threshold = **50,000**, condition = **below**, enable alerts
- [ ] Click **Create KPI**
- [ ] Card: Current ≈ 65,600, Target = 100,000, Progress ≈ 66%
- [ ] Progress bar AMBER (≥ 90% would be green)
- [ ] Yellow alert icon (hover: "Alerts enabled — threshold: 50,000 (below)")
- [ ] 65,600 > 50,000 → NO red pulsing dot

### Step 2: Create Engagement Rate KPI
- [ ] Click **Create KPI** → select **"Engagement Rate"** → ENABLED
- [ ] Current auto-populates (≈ 54%)
- [ ] Target = **70%** → Save
- [ ] Progress ≈ 77.1%, amber bar

### Step 3: Create Revenue KPI
- [ ] Select **"Revenue"** → ENABLED (revenue exists from simulation)
- [ ] Current auto-populates (≈ $240,352) → Target = **$500,000** → Save

### Step 4: Verify financial templates still DISABLED
- [ ] Click **Create KPI**
- [ ] **ROAS** — still DISABLED (grayed out — needs spend)
- [ ] **ROI** — still DISABLED
- [ ] **CPA** — still DISABLED
- [ ] Close dialog

### Step 5: Create CR Benchmark (no spend needed)
- [ ] Click the **Benchmarks** tab → click **Create Benchmark**
- [ ] Name = **"Conversion Rate"**, Current auto-populates, Benchmark = **5.00**, Unit = **%**
- [ ] Save → card shows status color (ON TRACK / NEEDS ATTENTION / BEHIND)

### Step 6: Verify financial benchmark templates still DISABLED
- [ ] Click **Create Benchmark**
- [ ] **ROAS, ROI, CPA** — DISABLED
- [ ] Close dialog

### Step 7: KPI/Benchmark Summary
- [ ] KPIs tab: Total = 3 (Sessions, Engagement Rate, Revenue). Counts per band correct.
- [ ] Benchmarks tab: Total = 1 (CR). Status correct.

---

## Journey 3: Run Refresh — Spend Arrives (Unlocks Financial Metrics)

**Why**: GA4 doesn't track spend. In production, spend initially arrives when the user adds it via the Add Spend wizard (manual entry, CSV, Google Sheets, or connecting an ad platform like LinkedIn/Meta/Google Ads). After an ad platform is connected, the daily scheduler updates spend automatically. Run Refresh simulates all schedulers at once — each click = 1 day.

### Step 1: First Run Refresh
- [ ] Click the **Overview** tab
- [ ] Find and click the **Run Refresh** button
- [ ] Toast appears with date + summary (Sessions = 1,170, Revenue = $4,200, Spend = $1,630)

### Step 2: Verify Overview — spend now exists
- [ ] **Total Spend = $1,630.00** (previously $0)
- [ ] Micro copy: **"Mock Spend — $1,630.00"**
  - This simulates what LinkedIn/Meta/Google Ads schedulers import from ad platform APIs
  - $1,630 = brand_search daily ad spend ($950) + prospecting daily ad spend ($680)
- [ ] **ROAS** now calculated (Revenue ÷ $1,630)
- [ ] **CPA** now calculated ($1,630 ÷ conversions)
- [ ] **ROI** now calculated

### Step 3: Financial KPI templates now ENABLED
- [ ] Click the **KPIs** tab → **Create KPI**
- [ ] **ROAS, ROI** — NOW ENABLED (spend + revenue both exist)
- [ ] **CPA** — NOW ENABLED (spend exists)
- [ ] Close dialog

### Step 4: "Spend missing" insight gone
- [ ] Click the **Insights** tab
- [ ] "Spend missing" integrity insight is GONE

### Step 5: Run Refresh ×2 more (3 days total)
- [ ] Click Run Refresh two more times
- [ ] **Spend accumulates**: 3 × $1,630 = **$4,890**
- [ ] Micro copy: "Mock Spend — $4,890.00"
- [ ] Revenue, Sessions, Conversions all increase

---

## Journey 4: Create Financial KPIs & Benchmarks (Spend Now Exists)

### Step 1: ROAS KPI
- [ ] Click the **KPIs** tab → **Create KPI** → select **"ROAS"** → ENABLED
- [ ] Current auto-populates (revenue ÷ spend × 100)
- [ ] Target = **500** (= 5.0x) → Save

### Step 2: CPA KPI (lower-is-better)
- [ ] Select **"CPA"** → ENABLED
- [ ] Current auto-populates (spend ÷ conversions)
- [ ] Target = **$20.00** → Save
- [ ] "Lower is better": if current > $20, progress reflects it's worse than target

### Step 3: ROI KPI
- [ ] Select **"ROI"** → ENABLED
- [ ] Current auto-populates → Target = **200%** → Save

### Step 4: ROAS Benchmark
- [ ] Click the **Benchmarks** tab → **Create Benchmark**
- [ ] Name = **"ROAS"**, Current auto-populates, Benchmark = **500** → Save

### Step 5: CPA Benchmark (lower-is-better)
- [ ] Name = **"CPA"**, Current auto-populates, Benchmark = **$20.00**
- [ ] Lower-is-better → ratio = benchmark ÷ current → Save

### Step 6: Summary
- [ ] KPIs tab: Total = 6 (3 non-financial from Journey 2 + 3 financial)
- [ ] Benchmarks tab: Total = 3 (CR from Journey 2 + ROAS + CPA)

---

## Journey 5: More Run Refreshes — Verify KPIs/Benchmarks Update

**Now that KPIs and Benchmarks exist (Journeys 3-4), verify they update when new daily data arrives.**

### Step 1: Run Refresh ×3 more
- [ ] Click **Run Refresh** three more times (you now have 6 total days of Run Refresh data)
- [ ] Each click: spend increases by $1,630, revenue by $4,200, sessions by 1,170

### Step 2: Verify KPIs updated
- [ ] Click the **KPIs** tab
- [ ] Sessions KPI: current value increased
- [ ] Revenue KPI: current value increased
- [ ] ROAS/CPA: recalculated with new accumulated totals
- [ ] Progress bars and delta text reflect new values

### Step 3: Verify Benchmarks updated
- [ ] Click the **Benchmarks** tab
- [ ] Current values updated on all benchmark cards

### Step 4: Verify Insights Trends
- [ ] Click the **Insights** tab → scroll to **Trends** section
- [ ] **Daily** chart: 6 data points visible (one per Run Refresh day)
- [ ] **Daily** table: 6 rows with day-over-day deltas (all ~0% since mock data is identical each day)
- [ ] **Monthly**: 1 bar for current month, "(partial, 6 days)"
- [ ] **Date picker**: set From/To to a 3-day range → chart shows 3 points → Clear resets

---

## Journey 6: Full Insights Verification

### Step 1: Insights list
- [ ] KPI insights: "Revenue Behind Target" or "ROAS Needs Attention" (correct grammar — no "is")
- [ ] Benchmark insights: "CPA Below Benchmark" (correct grammar)
- [ ] Informational: blue "Info" badge (not "Low")
- [ ] Blocked KPIs (if any): high severity integrity check

### Step 2: Insight descriptions
- [ ] "Current X vs target Y (Z% progress). Stable over recent period." (NOT "Trend neutral 0.0%")
- [ ] Channel recommendations reference "google / cpc"

### Step 3: Data Summary
- [ ] Sessions + daily avg
- [ ] Conversions + CR%
- [ ] Revenue + daily avg
- [ ] Top Channel + share%
- [ ] Channel Breakdown table with CR% (lowest highlighted red)
- [ ] Financial row: Spend, ROAS (green/red), CPA

### Step 4: Trends modes
- [ ] Daily: chart + table with deltas
- [ ] 7d/30d: "Need at least X days" if insufficient data
- [ ] Monthly: bar chart with partial month marker
- [ ] Date picker: From/To filters, Clear resets
- [ ] Users HIDDEN in 7d/30d/Monthly dropdown

---

## Journey 7: Add More Spend Sources

**After EACH source, verify: Total Spend = sum of micro copy, ROAS/CPA KPIs update**

### Step 1: CSV Spend
- [ ] "+" → CSV → upload file → preview → map Spend column → campaign filter → Import
- [ ] Toast: "Imported {N} row(s), total USD {amount}"
- [ ] Micro copy: "filename.csv — $X,XXX"
- [ ] Edit (pencil) → re-upload → update. Delete (trash) → recalculated

### Step 2: Google Sheets Spend
- [ ] "+" → Sheets → authenticate → select sheet → map → Save
- [ ] Micro copy: "Google Sheets — $X,XXX" (NOT spreadsheet name)
- [ ] Edit/Delete same pattern

### Step 3: LinkedIn Ads (Test Mode)
- [ ] "+" → LinkedIn → Test mode ON → mock campaigns table → select 2 → Import
- [ ] Toast: "Test spend imported — Saved USD {amount} from 2 mock campaign(s)"
- [ ] Micro copy: "LinkedIn Ads — $X,XXX"
- [ ] No extra UI elements not in production

### Step 4: Meta Ads (Test Mode)
- [ ] Same pattern → "Meta Ads — $X,XXX"

### Step 5: Google Ads (Test Mode)
- [ ] Same pattern → "Google Ads — $X,XXX"

### Step 6: Multiple sources active
- [ ] All sources shown in micro copy with individual amounts
- [ ] **Sum of ALL micro copy amounts = Total Spend card** (exact match, no rounding drift)
- [ ] Delete one → total decreases by that amount

---

## Journey 8: Add More Revenue Sources

**After EACH source, verify: Total Revenue = sum of micro copy, ROAS/Revenue KPIs update**

### Step 1: Manual Revenue
- [ ] "+" → Manual → $5,000 → Save
- [ ] Micro copy: "Manual revenue (to date) — $5,000"
- [ ] Edit/Delete same pattern

### Step 2: CSV Revenue
- [ ] "+" → CSV → upload → map Revenue + Campaign columns → Import
- [ ] Edit/Delete same

### Step 3: Google Sheets Revenue
- [ ] "+" → Sheets → authenticate → select → map → Save

### Step 4: HubSpot Revenue (if HubSpot connected)
- [ ] "+" → HubSpot → OAuth → campaign field → crosswalk → pipeline (optional) → revenue property → date field (Close Date default, Advanced section) → review → Save
- [ ] Micro copy: "HubSpot — $X,XXX"
- [ ] Non-default date field: "HubSpot · Modified Date"
- [ ] Edit: all settings prefilled. Delete: recalculated + connection cleared

### Step 5: Salesforce Revenue (if Salesforce connected)
- [ ] Same pattern → date field selector (CloseDate default)
- [ ] Micro copy: "Salesforce — $X,XXX"

### Step 6: Shopify Revenue (if Shopify connected)
- [ ] "+" → Shopify → domain + token → campaign field → revenue metric → Save

### Step 7: Multiple sources active
- [ ] All shown in micro copy
- [ ] **Sum = Total Revenue card**
- [ ] Delete one → total decreases

### Step 8: Double-Count Prevention Warning
- [ ] HubSpot wizard Revenue step: amber warning banner visible: "Only add HubSpot revenue if these deals are NOT already tracked as GA4 ecommerce transactions"
- [ ] Salesforce wizard Revenue step: same amber warning visible
- [ ] No "Revenue classification" dropdown (removed — hardcoded to offsite)

---

## Journey 9: Delete Sources → KPIs Become Blocked

### Step 1: Delete ALL spend sources
- [ ] Delete Manual entry + Mock Spend + any others
- [ ] Spend = $0
- [ ] **ROAS KPI → "Blocked"**
- [ ] **ROI KPI → "Blocked"** (if created)
- [ ] **CPA KPI → "Blocked"**
- [ ] Revenue/Sessions/ER/CR KPIs → still work
- [ ] KPI summary: blocked KPIs EXCLUDED from scoring
- [ ] Create KPI: ROAS/ROI/CPA templates DISABLED again
- [ ] Insights: "Spend missing" integrity check reappears

### Step 2: Delete ALL revenue sources
- [ ] Spend = $0, Revenue = $0
- [ ] **Revenue KPI → "Blocked"**
- [ ] ROAS/ROI already blocked (no spend)
- [ ] Only Sessions/ER/CR KPIs remain active
- [ ] Create KPI: only Sessions/Users/Conversions/ER/CR ENABLED

### Step 3: Restore via Run Refresh
- [ ] Click Run Refresh → creates Mock Spend + GA4 Revenue
- [ ] All KPIs become unblocked
- [ ] Templates re-enabled
- [ ] Integrity insights disappear

---

## Journey 10: Alerts & Notifications

### Step 1: Create KPI with breached threshold
- [ ] Create Sessions KPI: set threshold ABOVE current value, condition = below
- [ ] Example: current = 65,600, threshold = 70,000, condition = below → BREACHED
- [ ] Red pulsing dot on card
- [ ] Tooltip: "Alert Threshold Breached" + Current + Threshold + condition
- [ ] **Notifications bell**: badge count increased
- [ ] **/notifications page**: new entry

### Step 2: Run Refresh → dedup
- [ ] If still breached: NO duplicate notification (same calendar day)

### Step 3: Non-breached alert
- [ ] Create KPI with threshold well below current
- [ ] Yellow icon only (no red dot)
- [ ] Tooltip: "Alerts enabled — threshold: X (below)"

---

## Journey 11: Ad Comparison

- [ ] Switch metrics: Sessions, Conversions, Revenue, CR, Users
- [ ] Ranking cards update per selected metric
- [ ] Best Performing ≠ Needs Attention
- [ ] Users: tooltip warns "non-additive"

---

## Journey 12: Reports

- [ ] Overview PDF: values match Overview tab
- [ ] KPI PDF: values match KPI cards
- [ ] Benchmark PDF: values match cards
- [ ] Schedule report: frequency/time/recipients → save → appears in library
- [ ] Edit scheduled: all fields prefilled

---

## Journey 13: Cross-Tab Consistency

- [ ] Overview Spend = Insights Executive Financials Spend (exact)
- [ ] Overview Revenue = Insights Executive Financials Revenue (exact)
- [ ] Overview ROAS = Insights ROAS (exact)
- [ ] KPI ROAS Current ÷ 100 = Overview ROAS ratio
- [ ] KPI CPA Current = Overview CPA
- [ ] Same metric on KPI + Benchmark cards = identical Current Value
- [ ] Daily chart latest point = Overview Latest Day value

---

## Journey 14: Edge Cases

### Number formatting
- [ ] Threshold "2,300" → no DB error (commas stripped)
- [ ] Progress 99.5–99.9% → shows 1 decimal (not "100%")
- [ ] Delta <1% → shows 1 decimal (not "0% below target")
- [ ] Amount inputs → $500 formats to $500.00 on blur

### Spend/Revenue edge cases
- [ ] CSV with 1 row → works
- [ ] CSV with no matching campaigns → 0 rows, $0
- [ ] Sheets token expired → reconnect message
- [ ] Edit passes sourceId → no duplicate created
- [ ] HubSpot with 0 matching deals → $0 (warning shown)
- [ ] Multiple CRMs → both contribute to total

### Alert edge cases
- [ ] Threshold = current → "equals" condition triggers
- [ ] Multiple KPIs breached → multiple notifications
- [ ] Same KPI, same day → deduped

### Insights edge cases
- [ ] <2 days data → "Need 2 days" in Trends
- [ ] 6-13 days → 3d vs 3d anomaly detection
- [ ] 14+ days → full 7d WoW detection
- [ ] All KPIs on track → only informational insights

---

## Journey 15: Real Integration Tests (Requires Real Accounts)

**Why this is needed:** Journeys 1-14 use mock data. They prove the UI works correctly but do NOT prove that real API connections work. This journey requires real accounts connected on your Render staging environment.

**When to run this:** After Journeys 1-14 pass. You need real accounts for each platform you want to test.

### LinkedIn Ads (real connection)
- [ ] Go to a campaign → Connected Platforms → Connect LinkedIn Ads
- [ ] Complete OAuth flow with a real LinkedIn Ads account
- [ ] Select a real ad account → verify campaigns load from LinkedIn API
- [ ] Import spend from selected campaigns → verify real spend amounts appear
- [ ] **Wait 24 hours** (or trigger the LinkedIn scheduler manually if possible)
- [ ] Verify spend updated automatically — new daily spend from LinkedIn API
- [ ] Verify KPIs that depend on spend recalculated with new values

### Meta/Facebook Ads (real connection)
- [ ] Connect real Meta Ads account via OAuth
- [ ] Verify real campaigns load → import spend
- [ ] Wait for Meta scheduler to run → verify spend updated
- [ ] Verify ROAS/CPA recalculated

### Google Ads (real connection)
- [ ] Connect real Google Ads account
- [ ] Verify real campaigns load → import spend
- [ ] Wait for Google Ads scheduler to run → verify spend updated

### Google Sheets — Spend (real connection)
- [ ] Create a Google Sheet with columns: Date, Spend, Campaign
- [ ] Add some rows with known values (e.g., 5 rows totaling $5,000)
- [ ] Connect the sheet as a spend source → verify $5,000 imported
- [ ] **Add more rows to the spreadsheet** (e.g., add $1,000 more)
- [ ] Wait for Sheets scheduler to run (or reconnect/re-import)
- [ ] Verify spend updated to $6,000

### Google Sheets — Revenue (real connection)
- [ ] Create a Google Sheet with columns: Date, Revenue, Campaign
- [ ] Connect as revenue source → verify amount imported
- [ ] Update spreadsheet → verify revenue updates after scheduler

### HubSpot (real connection)
- [ ] Connect real HubSpot account via OAuth
- [ ] Complete the wizard: campaign field → crosswalk → revenue property → date field
- [ ] Verify deal count + revenue total match what you see in HubSpot
- [ ] **Create a new deal in HubSpot** with known amount
- [ ] Wait for next scheduler run → verify revenue increased by that amount
- [ ] Verify ROAS/Revenue KPIs updated

### Salesforce (real connection)
- [ ] Connect real Salesforce account via OAuth
- [ ] Complete wizard: campaign field → revenue field → date field
- [ ] Verify opportunity count + revenue match Salesforce
- [ ] Create a new Closed Won opportunity in Salesforce
- [ ] Wait for scheduler → verify revenue updated

### Shopify (real connection)
- [ ] Connect real Shopify store (domain + admin token)
- [ ] Complete wizard: campaign field → revenue metric
- [ ] Verify order count + revenue match Shopify
- [ ] If a new order comes in → verify revenue updates after scheduler

### GA4 (real connection)
- [ ] Connect a real GA4 property (not yesop mock)
- [ ] Verify sessions/users/conversions/revenue populate from real GA4 data
- [ ] Wait 24 hours → verify `ga4-daily` has a new row with yesterday's data
- [ ] Verify Overview cards updated with latest values

### What to verify after each real scheduler run
- [ ] New data appears in the Overview tab (spend/revenue cards)
- [ ] KPI current values recalculated with new data
- [ ] Benchmark current values updated
- [ ] Insights regenerate (new anomalies or changed recommendations)
- [ ] Alert thresholds re-evaluated → notifications created if breached

---

## Final Checklist

### Part A: Mock Testing (Journeys 1-14)
1. Every number traces to a known source (simulation OR Run Refresh OR manual entry)
2. Spend/revenue changes propagate to ROAS/ROI/CPA/KPIs/Benchmarks/Insights
3. Run Refresh accumulates correctly + triggers KPI progress + alerts
4. No cross-tab inconsistencies
5. Templates DISABLED when required data missing; ENABLED when data exists
6. Blocked KPIs excluded from scoring + show integrity insight
7. Notifications created when thresholds breached
8. All spend sources (Manual/CSV/Sheets/LinkedIn/Meta/Google Ads) work
9. All revenue sources (GA4/Manual/CSV/Sheets/HubSpot/Salesforce/Shopify) work
10. Total Spend = sum of micro copy (exact)
11. Total Revenue = GA4 onsite + CRM offsite (no double-counting)
12. Edit → no duplicates. Delete → recalculates.

### Part B: Real Integration Testing (Journey 15)
13. Each real platform connection completes OAuth successfully
14. Each platform's scheduler fetches real data and updates the DB
15. KPIs/Benchmarks/Insights recalculate after real scheduler runs
16. No stale data — values reflect the latest scheduler run
17. Alert notifications created for real threshold breaches
