# GA4 Manual Test Plan — User Journeys

## How This Plan Works
Each journey follows the real user flow as closely as possible.

Use the plan in 2 modes:

- baseline mode: start with Journey 1 and work forward on a clean or clearly understood campaign state
- regression mode: retest the affected journey first, then run the Shared Regression Sweep

Important:

- treat the GA4 docs as the product spec if a step here is ambiguous
- treat exact mock numbers as reference values, not absolute truth, unless the campaign state is clean
- if a campaign already has prior `Run Refresh` history or added sources, prioritize directional correctness over exact sample numbers

## Purpose
Use this plan to:

- validate the intended GA4 user journey
- verify cross-tab consistency
- catch regressions after bug fixes
- confirm that refresh and recomputation behavior remain trustworthy

## Recommended Testing Workflow

Do not use this plan only as one long uninterrupted script.

Recommended process:

1. run the journeys sequentially when establishing a fresh baseline
2. when a bug is fixed, retest the affected journey first
3. then run the Shared Regression Sweep below
4. use `Run Refresh` when the bug touches calculations, freshness, KPIs, Benchmarks, Insights, or Reports
5. only continue to the next journey after the fixed area and regression sweep both pass

## Test Preconditions

Before starting a fresh run:

- use a known test client
- start from a clean or clearly understood campaign state
- note whether the run is baseline validation, regression retest, or real integration verification
- record the campaign name used for the run

## Evidence Capture

For any failed step, capture:

- journey number
- step number
- campaign name
- tab/page
- expected result
- actual result
- whether `Run Refresh` had been used
- whether the issue blocks the rest of the plan or only affects one area

## What To Do If You Find A Bug

If a step fails:

1. stop at the failing step
2. capture the evidence listed above
3. decide whether the issue is:
   - a real bug
   - a stale test-plan step
   - a documented current-state caveat or deferred enhancement
4. if it is a real bug, add or update the item in `GA4_BUG_QUEUE.md`
5. do a root-cause trace before changing code
6. do not change code until root cause is confirmed
7. make the smallest safe fix
8. retest the failed step first
9. run the Shared Regression Sweep
10. add automated regression coverage if the bug is high risk and deterministic

## Shared Regression Sweep

After any GA4 bug fix, run this short regression sweep before moving on:

- Overview: core cards still populate correctly
- Overview: financial cards still recompute correctly
- KPIs: current values and Executive snapshot still match
- Benchmarks: current values and Executive snapshot still match
- Ad Comparison: selected metric and ranking still update
- Insights: Executive Financials and findings still reflect current values
- Reports: on-demand output still reflects current tab state
- Connected source rows: edit/delete still recompute totals correctly

## Stop Rules

Pause the current run and log the issue if:

- a shared financial value stops matching across tabs
- a fix breaks an unrelated GA4 tab
- `Run Refresh` stops updating downstream tabs correctly
- source edit/delete creates duplicate or stale values
- KPI or Benchmark current values no longer align with Overview values

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
Simulates what happens in production when the **GA4 daily scheduler** runs:
- Fetches daily metrics from Google Analytics API (sessions, users, conversions, revenue)
- Revenue is included because GA4 tracks ecommerce/purchase events
- **Spend is NOT included** — in production, spend arrives when the user adds it via the Add Spend wizard (manual, CSV, Sheets, or connecting an ad platform). After an ad platform is connected, its scheduler updates spend daily.

In the mock system, each click uses fixed daily values from the two selected campaigns:

| Metric | brand_search | prospecting | **Daily total** |
|--------|-------------|-------------|----------------|
| Sessions | 750 | 420 | **1,170** |
| Conversions | 38 | 18 | **56** |
| Revenue | $2,850 | $1,350 | **$4,200** |

So after each Run Refresh click:
- Sessions increase by 1,170
- Conversions increase by 56
- Revenue increases by $4,200 (shows as "GA4 Revenue" source)
- **Spend stays at $0** until the user adds it via Add Spend

After Run Refresh, the `ga4-to-date` and `ga4-daily` endpoints prefer real DB rows over simulation. So the Overview totals will shift from simulation values to accumulated Run Refresh values.

Note:

- the mock refresh path is intended to produce visibly updated KPI and Benchmark inputs on rerun
- if the campaign already has previous refresh history, use delta checks and cross-tab consistency rather than expecting one exact hard-coded total

**3. Add Spend (user action via "+" button on Spend card)**
Spend arrives when the user explicitly adds it:
- **Manual entry**: type an amount directly
- **CSV upload**: upload a CSV with spend data
- **Google Sheets**: connect a spreadsheet with spend data
- **Ad platforms (test mode)**: LinkedIn/Meta/Google Ads with mock campaign data
- **Ad platforms (production)**: connect via OAuth, scheduler updates daily thereafter

---

## Journey 1: Create Campaign + Connect GA4

Checkpoint after Journey 1:

- campaign creation works
- GA4 entry path works
- Overview baseline values are trustworthy
- KPI and Benchmark template gating is correct
- Insights loads without broken dependencies

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
- [ ] Click the **Ad Comparison** tab
- [ ] Campaign breakdown table visible with data from simulation

---

## Journey 2: Create Non-Financial KPIs & Benchmarks (No Spend Yet)

**State**: Metrics + revenue exist from simulation. Spend = $0. This is the default state after connecting GA4 — test it before adding spend.

Checkpoint after Journey 2:

- non-financial KPI creation works
- non-financial Benchmark creation works
- financial template gating still holds before spend is added

### Step 1: Create Sessions KPI
- [ ] Click the **KPIs** tab → click **Create KPI**
- [ ] Select **"Total Sessions"** template → ENABLED (no spend needed)
- [ ] Current auto-populates (note the value — should match Overview sessions ≈ 65,600)
- [ ] Set Target = **100,000**
- [ ] Alert: threshold = **50,000**, condition = **below**, enable alerts
- [ ] Click **Create KPI**
- [ ] Card: Current ≈ 65,600, Target = 100,000, Progress ≈ 66%
- [ ] Progress bar RED (`Below Target`)
- [ ] Yellow alert icon (hover: "Alerts enabled — threshold: 50,000 (below)")
- [ ] 65,600 > 50,000 → NO red pulsing dot

### Step 2: Create Engagement Rate KPI
- [ ] Click **Create KPI** → select **"Engagement Rate"** → ENABLED
- [ ] Current auto-populates (≈ 54%)
- [ ] Target = **70%** → Save
- [ ] Progress ≈ 77.1%, red bar (`Below Target`)

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
- [ ] Name = **"Conversion Rate"**, Current auto-populates, enter **Benchmark Value = 5.00**, Unit = **%**
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

**Why**: GA4 doesn't track spend. In production, spend arrives when the user adds it via the Add Spend wizard (manual entry, CSV, Google Sheets, or connecting an ad platform). Run Refresh only simulates the GA4 scheduler (sessions, conversions, revenue) — it does NOT bring in spend.

Checkpoint after Journey 3:

- Run Refresh updates GA4 values only
- Add Spend works
- financial metrics unlock correctly
- Insights integrity behavior updates correctly

### Step 1: Run Refresh (GA4 data only, no spend)
- [ ] Click the **Overview** tab
- [ ] Find and click the **Run Refresh** button
- [ ] Toast appears with date + summary: sessions, conversions, revenue — **NO spend**
- [ ] **Spend still = $0** — Run Refresh does not create spend
- [ ] **Sessions ≈ 66,770** (simulation baseline 65,600 + 1 day of 1,170)
- [ ] **Conversions ≈ 2,648** (simulation 2,592 + 1 day of 56)
- [ ] **Revenue ≈ $244,552** (simulation $240,352 + 1 day of $4,200)
- [ ] Values AGGREGATE — simulation baseline + Run Refresh increments, not replaced
- [ ] If GA4 native revenue exists, the `GA4 Revenue` micro copy row under `Total Revenue` updates to the refreshed aggregated GA4 amount for the selected GA4 scope
- [ ] Financial templates (ROAS/ROI/CPA) still DISABLED — need spend

### Step 2: Add spend via Add Spend wizard
- [ ] On the Overview tab, click the **"+"** icon on the Total Spend card
- [ ] Select **Manual** entry
- [ ] Enter spend amount: **$5,000.00**
- [ ] Click Save
- [ ] **Total Spend = $5,000.00**
- [ ] Micro copy: **"Manual — $5,000.00"**

### Step 3: Verify financial metrics unlocked
- [ ] **ROAS** now calculated (Revenue ÷ $5,000)
- [ ] **CPA** now calculated ($5,000 ÷ conversions)
- [ ] **ROI** now calculated

### Step 4: Financial KPI templates now ENABLED
- [ ] Click the **KPIs** tab → **Create KPI**
- [ ] **ROAS, ROI** — NOW ENABLED (spend + revenue both exist)
- [ ] **CPA** — NOW ENABLED (spend exists)
- [ ] Close dialog

### Step 5: "Spend missing" insight gone
- [ ] Click the **Insights** tab
- [ ] "Spend missing" integrity insight is GONE

### Step 6: Run Refresh ×2 more (3 days total)
- [ ] Click Run Refresh two more times
- [ ] **Spend stays at $5,000** — Run Refresh only adds GA4 data
- [ ] After 3 total Run Refreshes:
  - Sessions ≈ 65,600 + (3 × 1,170) = **69,110**
  - Conversions ≈ 2,592 + (3 × 56) = **2,760**
  - Revenue ≈ $240,352 + (3 × $4,200) = **$252,952**

---

## Journey 4: Create Financial KPIs & Benchmarks (Spend Now Exists)

Checkpoint after Journey 4:

- financial KPI creation works
- financial Benchmark creation works
- current values align with Overview financial metrics

### Step 1: ROAS KPI
- [ ] Click the **KPIs** tab → **Create KPI** → select **"ROAS"** → ENABLED
- [ ] Current auto-populates as ratio (e.g., **48.91** meaning 48.91x return) — matches Overview ROAS
- [ ] Unit shows as **ratio** (displayed with "x" suffix)
- [ ] Target = **50** (= 50x return) → Save
- [ ] Progress ≈ 97.8% (48.91 / 50), blue bar (`On Track`)

### Step 2: CPA KPI (lower-is-better)
- [ ] Select **"CPA"** → ENABLED
- [ ] Current auto-populates (spend ÷ conversions, e.g., ~$1.81 with $5K spend and ~2,760 conversions)
- [ ] Target = **$5.00** → Save
- [ ] "Lower is better": current < $5 → progress reflects it's better than target (green bar)

### Step 3: ROI KPI
  [ ] Select **"ROI"** → ENABLED
- [ ] Current auto-populates (very high % since revenue >> spend) → Target = **5000%** → Save

### Step 4: ROAS Benchmark
- [ ] Click the **Benchmarks** tab → **Create Benchmark**
- [ ] Name = **"ROAS"**, Current auto-populates (ratio, e.g., 48.91), Benchmark = **50** (= 50x) → Save

### Step 5: CPA Benchmark (lower-is-better)
- [ ] Name = **"CPA"**, Current auto-populates (e.g., ~$1.81), Benchmark = **$5.00**
- [ ] Lower-is-better → ratio = benchmark ÷ current → Save

### Step 6: Summary
- [ ] KPIs tab: Total = 6 (3 non-financial from Journey 2 + 3 financial)
- [ ] Benchmarks tab: Total = 3 (CR from Journey 2 + ROAS + CPA)

---

## Journey 5: More Run Refreshes — Verify KPIs/Benchmarks Update

**Now that KPIs and Benchmarks exist (Journeys 3-4), verify they update when new daily data arrives.**

Checkpoint after Journey 5:

- KPI current values recompute after refresh
- Benchmark current values recompute after refresh
- Insights trends reflect the added history

### Step 1: Run Refresh ×3 more
- [ ] Click **Run Refresh** three more times (you now have 6 total days of Run Refresh data)
- [ ] Each click: GA4 sessions, conversions, and revenue increase again
- [ ] Spend does NOT increase unless the user adds or edits a spend source separately

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
- [ ] **Daily** chart: data points visible (simulation + Run Refresh days)
- [ ] **Daily** table: rows with day-over-day deltas
- [ ] **Monthly**: 1 bar for current month

---

## Journey 5B: Edit & Delete KPIs and Benchmarks

**State**: 6 KPIs and 3 Benchmarks exist from Journeys 2 + 4. Test that editing and deleting works correctly and totals/scoring update.

Checkpoint after Journey 5B:

- edit flows preserve existing records correctly
- delete flows recalculate summary cards correctly
- deleted items no longer affect Insights or notifications

### Step 1: Edit a KPI — change target
- [ ] Click the **KPIs** tab
- [ ] Find the **Sessions** KPI card → click the **Edit** (pencil) icon
- [ ] The edit modal opens with all fields pre-filled (name, description, current, target, unit, priority, alert settings)
- [ ] Change Target from **100,000** to **80,000**
- [ ] Click **Update KPI**
- [ ] Card updates: progress % increases (closer to the lower target)
- [ ] Summary card counts may change (e.g., if progress crosses a band threshold)

### Step 2: Edit a KPI — change alert threshold
- [ ] Find the **Sessions** KPI card → click **Edit**
- [ ] Change alert threshold from **50,000** to **60,000**
- [ ] Click **Update KPI**
- [ ] If current > 60,000: yellow alert icon, NO red pulsing dot
- [ ] If current < 60,000: red pulsing dot appears → notification created
- [ ] Hover tooltip shows updated threshold: "threshold: 60,000 (below)"

### Step 3: Edit a Benchmark — change benchmark value
- [ ] Click the **Benchmarks** tab
- [ ] Find the **Conversion Rate** benchmark → click the **Edit** (pencil) icon
- [ ] Edit modal opens with all fields pre-filled
- [ ] Change Benchmark value from **5.00** to **3.50**
- [ ] Click **Update Benchmark**
- [ ] Card updates: status changes (closer to or exceeding the lower benchmark)
- [ ] Progress bar and delta text reflect new comparison

### Step 4: Delete a KPI
- [ ] Click the **KPIs** tab
- [ ] Find the **Engagement Rate** KPI card → click the **Delete** (trash) icon
- [ ] Confirmation dialog appears: "Are you sure you want to delete this KPI?"
- [ ] Click **Delete**
- [ ] Card disappears from the grid
- [ ] **Summary cards update**: Total KPIs decreases from 6 to 5
- [ ] Band counts recalculate (Above/On Track/Below totals change)
- [ ] Avg. Progress recalculates without the deleted KPI

### Step 5: Delete a Benchmark
- [ ] Click the **Benchmarks** tab
- [ ] Find the **CPA** benchmark → click the **Delete** (trash) icon
- [ ] Confirmation dialog appears
- [ ] Click **Delete**
- [ ] Card disappears
- [ ] **Summary cards update**: Total Benchmarks decreases from 3 to 2
- [ ] On Track/Needs Attention/Behind counts recalculate

### Step 6: Verify Insights reflect changes
- [ ] Click the **Insights** tab
- [ ] Deleted KPIs/Benchmarks no longer appear in insights list
- [ ] Remaining KPI insights reflect the updated targets (e.g., Sessions target is now 80,000)
- [ ] Remaining Benchmark insights reflect updated benchmark values

### Step 7: Verify cascade delete
- [ ] The deleted KPIs should also have their `kpiProgress` and `kpiAlerts` records removed
- [ ] No orphaned alerts or progress entries for deleted KPIs
- [ ] **Notifications page**: no new alerts for deleted KPIs after this point

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
- [ ] Users HIDDEN in 7d/30d/Monthly dropdown

---

## Journey 7: Add More Spend Sources + Verify Propagation

**Purpose**: Test adding spend from different sources and verify that new spend values propagate correctly to ALL tabs — Overview financial metrics, KPIs, Benchmarks, and Insights.

Checkpoint after Journey 7:

- all supported spend-source journeys work
- totals are cumulative where expected
- edits replace rather than duplicate
- deletes fully recompute downstream values

### Step 1: Note current values before adding spend
- [ ] **Overview tab**: note Total Spend, ROAS, ROI, CPA, Profit values
- [ ] **KPIs tab**: note ROAS KPI current value, CPA KPI current value
- [ ] **Benchmarks tab**: note ROAS Benchmark current value, CPA Benchmark current value
- [ ] **Insights tab**: note Data Summary financial row values (Spend, Profit, ROAS, CPA)

### Step 2: Add CSV Spend
- [ ] Overview tab → click "+" on Total Spend card → select **CSV**
- [ ] Upload a CSV file with spend data → preview → map Spend column → Import
- [ ] Toast: "Imported {N} row(s), total USD {amount}"
- [ ] Micro copy: "filename.csv — $X,XXX"
- [ ] **Total Spend increased** by the CSV amount

### Step 3: Verify propagation after CSV spend
- [ ] **Overview tab**: ROAS decreased (same revenue ÷ higher spend), CPA increased, ROI decreased, Profit decreased
- [ ] **KPIs tab**: ROAS KPI current value decreased, CPA KPI current value increased, progress bars updated
- [ ] **Benchmarks tab**: ROAS Benchmark current value decreased, CPA Benchmark current value increased
- [ ] **Insights tab**: Data Summary financial row reflects new Spend, Profit, ROAS, CPA values
- [ ] **Insights tab**: any spend-related insights updated (e.g., ROAS insight may change severity)

### Step 4: Add LinkedIn Ads (Test Mode)
- [ ] "+" → LinkedIn → Test mode ON → mock campaigns table → select 2 → Import
- [ ] Toast: "Test spend imported — Saved USD {amount} from 2 mock campaign(s)"
- [ ] Micro copy: "LinkedIn Ads — $X,XXX"
- [ ] No extra UI elements not in production
- [ ] **Total Spend = Manual + CSV + LinkedIn** (cumulative)

### Step 5: Add Meta Ads (Test Mode)
- [ ] Same pattern → "Meta Ads — $X,XXX"
- [ ] **Total Spend = Manual + CSV + LinkedIn + Meta**

### Step 6: Add Google Ads (Test Mode)
- [ ] Same pattern → "Google Ads — $X,XXX"
- [ ] **Total Spend = Manual + CSV + LinkedIn + Meta + Google Ads**

### Step 7: Verify all sources active
- [ ] All sources shown in micro copy with individual amounts
- [ ] **Sum of ALL micro copy amounts = Total Spend card** (exact match, no rounding drift)
- [ ] ROAS/CPA/ROI/Profit all reflect the cumulative total spend

### Step 8: Edit a spend source
- [ ] Click edit (pencil) on the CSV source
- [ ] Confirm `Update spend` is **disabled** immediately on open before any changes are made
- [ ] Deselect one campaign value while keeping one valid campaign selected
- [ ] Confirm `Update spend` becomes enabled after the mapping change
- [ ] Click `Update spend`
- [ ] Total Spend recalculated from the stored CSV dataset (old CSV amount replaced, not duplicated)
- [ ] ROAS/CPA updated accordingly
- [ ] **No duplicate source created** — same source ID, updated amount
- [ ] Reopen the same CSV source in edit mode and restore the original campaign selection
- [ ] Confirm `Update spend` becomes disabled again when the edit state matches the saved mapping

### Step 9: Delete a spend source
- [ ] Click delete (trash) on the LinkedIn source → confirm
- [ ] Total Spend decreases by the LinkedIn amount
- [ ] Micro copy: LinkedIn line disappears
- [ ] ROAS/CPA/Profit recalculated
- [ ] **KPIs tab**: ROAS/CPA KPIs reflect the reduced spend
- [ ] **Benchmarks tab**: ROAS/CPA Benchmarks reflect the reduced spend
- [ ] **Insights tab**: financial row updated

### Step 10: Add Google Sheets Spend
- [ ] In the initial connect substate, confirm there is **no** redundant footer `Next` button before a connected sheet/tab is selected
- [ ] "+" → Sheets → authenticate → select sheet → map Spend column
- [ ] Select a campaign identifier column and leave all campaign values unselected
- [ ] Confirm `Import spend` is blocked/disabled until at least one campaign value is selected
- [ ] Select one or more campaign values → Save
- [ ] Micro copy: "Google Sheets — $X,XXX" (NOT the spreadsheet name)
- [ ] Click edit (pencil) on the Google Sheets source
- [ ] Confirm the chooser does **not** show an in-flow `Remove` action
- [ ] Confirm `Update spend` is **disabled** immediately on open before any changes are made
- [ ] Deselect one campaign value while keeping one valid campaign selected
- [ ] Confirm `Update spend` becomes enabled after the mapping change
- [ ] Click `Update spend`
- [ ] Total Spend recalculated (old Google Sheets amount replaced, not duplicated)
- [ ] Reopen the same Google Sheets source in edit mode and restore the original campaign selection
- [ ] Confirm `Update spend` becomes disabled again when the edit state matches the saved mapping
- [ ] Delete still follows the same pattern as other sources

---

## Journey 8: Add More Revenue Sources + Verify Propagation

**Purpose**: Test adding revenue from different sources and verify that new revenue values propagate correctly to ALL tabs — Overview financial metrics, KPIs, Benchmarks, and Insights.

Checkpoint after Journey 8:

- all supported revenue-source journeys work
- total revenue remains additive
- downstream ROAS, ROI, Profit, KPI, Benchmark, and Insights values stay aligned

### Step 1: Note current values before adding revenue
- [ ] **Overview tab**: note Total Revenue, ROAS, ROI, Profit values
- [ ] **KPIs tab**: note Revenue KPI current value, ROAS KPI current value
- [ ] **Benchmarks tab**: note ROAS Benchmark current value
- [ ] **Insights tab**: note Executive Financials revenue, Data Summary revenue

### Step 2: Add Manual Revenue
- [ ] Overview tab → click "+" on Total Revenue card → select **Manual**
- [ ] Enter $10,000 → Save
- [ ] Micro copy: "Manual — $10,000.00"
- [ ] **Total Revenue increased** by $10,000

### Step 3: Verify propagation after manual revenue
- [ ] **Overview tab**: ROAS increased (higher revenue ÷ same spend), ROI increased, Profit increased
- [ ] **KPIs tab**: Revenue KPI current value increased, ROAS KPI current value increased
- [ ] **Benchmarks tab**: ROAS Benchmark current value increased
- [ ] **Insights tab**: Executive Financials revenue updated, Data Summary revenue updated
- [ ] **Insights tab**: Executive Financials cards do **not** show repeated per-card micro copy under Spend/Revenue/Profit/ROAS/ROI
- [ ] **Insights tab**: shared `Sources used` provenance lists the full active revenue source set, not only the first imported source

### Step 4: Add CSV Revenue
- [ ] "+" → CSV → upload → map Revenue + Campaign columns
- [ ] Optional: map a Date column only if you want daily revenue history
- [ ] Confirm the Date column supports daily history / latest-day style calculations but does **not** make CSV auto-refreshing
- [ ] Leave campaign values unselected after choosing a campaign column
- [ ] Confirm `Import revenue` is blocked/disabled until at least one campaign value is selected
- [ ] Select one or more campaign values → Import
- [ ] Micro copy shows CSV source with amount
- [ ] **Total Revenue = GA4 native + Manual + CSV**
- [ ] Click edit (pencil) on the CSV revenue source
- [ ] Confirm it opens directly into the mapping screen with preview loaded
- [ ] Confirm `Update revenue` is **disabled** immediately on open before any changes are made
- [ ] Deselect one campaign value while keeping one valid value selected
- [ ] Confirm `Update revenue` becomes enabled after the mapping change
- [ ] Click `Update revenue`
- [ ] Total Revenue recalculated from the stored CSV dataset (old CSV revenue replaced, not duplicated)
- [ ] Reopen the same CSV revenue source in edit mode and restore the original campaign selection
- [ ] Confirm `Update revenue` becomes disabled again when the edit state matches the saved mapping
- [ ] Delete (trash) → recalculated

### Step 5: Add Google Sheets Revenue
- [ ] "+" → Sheets → authenticate → select → map Revenue column
- [ ] Optional: map a Date column only if you want daily revenue history
- [ ] Confirm the Date column supports daily history / latest-day style calculations but does **not** by itself create automatic daily syncing
- [ ] Select a campaign column and leave all campaign values unselected
- [ ] Confirm `Import revenue` is blocked/disabled until at least one campaign value is selected
- [ ] Select one or more campaign values → Import
- [ ] Micro copy: "Google Sheets — $X,XXX"
- [ ] Click edit (pencil) on the Google Sheets revenue source
- [ ] Confirm `Update revenue` is **disabled** immediately on open before any changes are made
- [ ] Deselect one campaign value while keeping one valid value selected
- [ ] Confirm `Update revenue` becomes enabled after the mapping change
- [ ] Click `Update revenue`
- [ ] Total Revenue recalculated (old Google Sheets revenue replaced, not duplicated)
- [ ] Reopen the same Google Sheets revenue source in edit mode and restore the original campaign selection
- [ ] Confirm `Update revenue` becomes disabled again when the edit state matches the saved mapping

### Step 6: Add HubSpot Revenue (if HubSpot connected)
- [ ] "+" → HubSpot → OAuth → campaign field → crosswalk → pipeline (optional) → revenue property → date field (Close Date default) → review → Save
- [ ] Confirm `Reconnect` appears immediately in a stable header/action area on the first screen
- [ ] Confirm the first HubSpot screen does **not** show an unnecessary vertical scrollbar
- [ ] Confirm the main double-counting warning appears on the first `Source` step before the user proceeds deeper into the wizard
- [ ] Micro copy: "HubSpot — $X,XXX"
- [ ] Non-default date field: "HubSpot · Modified Date"
- [ ] Confirm the Date field copy makes clear that it controls which HubSpot deal date is used when including/reporting revenue
- [ ] Confirm `Save Mappings` shows a single `Total Revenue (to date)` value and that it displays the computed amount before save
- [ ] Edit: all settings prefilled. Delete: recalculated + connection cleared

### Step 7: Salesforce Revenue (if Salesforce connected)
- [ ] Same pattern → date field selector (CloseDate default)
- [ ] Micro copy: "Salesforce — $X,XXX"
- [ ] On the Source step, confirm `Reconnect` appears on the first step only and `Connected to ...` is not repeated on later steps
- [ ] Confirm the main double-counting warning appears on the first `Source` step before the user proceeds deeper into the wizard
- [ ] Confirm `Total Revenue only (no Pipeline card)` appears above `Total Revenue + Pipeline (Proxy)`
- [ ] Move from `Pipeline` to `Revenue`
- [ ] Confirm the `Pipeline` step icon turns green/completed once you move past it
- [ ] Confirm the Crosswalk step does not show a redundant `Refresh values` action
- [ ] Open the Salesforce revenue source in edit mode
- [ ] Change the selected deal values in Crosswalk
- [ ] Go to the final review step
- [ ] Confirm `Total Revenue (to date)` refreshes to the new computed amount for the edited deal selection
- [ ] Save the edit
- [ ] Confirm the existing Salesforce micro copy/source row is updated in place
- [ ] Confirm save does **not** create a second additive Salesforce revenue micro copy entry under `Total Revenue`

### Step 8: Shopify Revenue (if Shopify connected)
- [ ] "+" → Shopify → domain + token → campaign field → revenue metric → Save

### Step 9: Verify all revenue sources active
- [ ] All shown in micro copy with individual amounts
- [ ] **Sum of ALL micro copy amounts = Total Revenue card** (exact match)
- [ ] ROAS/ROI/Profit all reflect cumulative total revenue
- [ ] **Insights tab**: `Sources used` Revenue line shows the full active revenue source set, not just the first imported source

### Step 10: Edit a revenue source
- [ ] Click edit (pencil) on Manual source → change amount → Save
- [ ] Total Revenue recalculated (old amount replaced, not duplicated)
- [ ] ROAS/Revenue KPIs updated accordingly

### Step 11: Delete a revenue source
- [ ] Click delete (trash) on one source → confirm
- [ ] Total Revenue decreases by that amount
- [ ] **KPIs tab**: Revenue/ROAS KPIs reflect reduced revenue
- [ ] **Benchmarks tab**: ROAS Benchmark reflects reduced revenue
- [ ] **Insights tab**: financial values updated

### Step 12: Double-Count Prevention Warning
- [ ] HubSpot wizard Source step: amber warning banner visible before the user continues: "Only add HubSpot revenue if these deals are NOT already tracked as GA4 ecommerce transactions"
- [ ] Salesforce wizard Source step: same amber warning visible before the user continues
- [ ] No "Revenue classification" dropdown (removed — hardcoded to offsite)

---

## Journey 9: Delete Sources → KPIs Become Blocked

### Step 1: Delete ALL spend sources
- [ ] Delete Manual entry + any ad platform sources + CSV/Sheets sources
- [ ] Spend = $0
- [ ] **ROAS KPI → "Blocked"**
- [ ] **ROI KPI → "Blocked"** (if created)
- [ ] **CPA KPI → "Blocked"**
- [ ] Revenue/Sessions/ER/CR KPIs → still work
- [ ] KPI summary: blocked KPIs EXCLUDED from scoring
- [ ] Create KPI: ROAS/ROI/CPA templates DISABLED again
- [ ] KPI blocked-state cards do **not** show a `Manage Connected Platforms` CTA
- [ ] Benchmark blocked-state cards do **not** show a `Manage Connected Platforms` CTA
- [ ] Blocked Benchmark card message matches the KPI pattern, e.g. `Missing: Spend. This Benchmark is paused until inputs are restored.`
- [ ] Insights: "Spend missing" integrity check reappears

### Step 2: Delete ALL revenue sources
- [ ] Delete all imported/manual revenue sources
- [ ] If GA4 native revenue still exists, **Total Revenue stays above $0** and Revenue-based KPIs remain evaluable
- [ ] `Total Revenue = $0` only if **all** revenue inputs are gone, including GA4 native revenue
- [ ] If GA4 native revenue is absent too, **Revenue KPI → "Blocked"**
- [ ] ROAS/ROI may already be blocked from Step 1 because spend is missing
- [ ] Sessions/Users/Conversions/ER/CR KPIs remain active
- [ ] Revenue template becomes disabled only when no GA4 native revenue and no imported revenue remain

### Step 3: Restore required inputs explicitly
- [ ] If GA4 native revenue is expected for this campaign and the GA4 connection/scope is still valid, click `Run Refresh` to repopulate fresh GA4 revenue data
- [ ] If this campaign/property truly has no GA4 revenue, `Run Refresh` will **not** create revenue; restore revenue by adding an imported revenue source instead
- [ ] If spend is missing: add a spend source again via the "+" Spend flow
- [ ] After the required inputs exist again, blocked KPIs should become unblocked
- [ ] Templates should re-enable only when their required inputs exist again
- [ ] Integrity insights should clear only after the missing input is truly restored

---

## Journey 10: Alerts & Notifications

### Step 1: Create KPI with breached threshold
- [ ] Create Sessions KPI: set threshold ABOVE current value, condition = below
- [ ] Example: current = 65,600, threshold = 70,000, condition = below → BREACHED
- [ ] Red pulsing dot on card
- [ ] Tooltip: "Alert Threshold Breached" + Current + Threshold + condition
- [ ] **Notifications bell**: badge count increased
- [ ] **/notifications page**: new entry
- [ ] Bell/page current value matches the live KPI card current value
- [ ] If older duplicate KPI rows exist for the same GA4 campaign + metric, only the latest row is allowed to produce the active alert
- [ ] Reopening the bell reflects the current server state (old resolved alerts do not linger from stale client cache)

### Step 2: Run Refresh → dedup
- [ ] If still breached: NO duplicate notification (same calendar day)
- [ ] If a fresher same-day alert supersedes an older one, the older notification is hidden from the active bell/feed

### Step 3: Non-breached alert
- [ ] Create KPI with threshold well below current
- [ ] Yellow icon only (no red dot)
- [ ] Tooltip: "Alerts enabled — threshold: X (below)"

---

## Journey 11: Ad Comparison

- [ ] Open the **Ad Comparison** tab
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
- [ ] KPI ROAS Current = Overview ROAS ratio (both show same value, e.g., 48.91x)
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
- [ ] Salesforce revenue edit save passes source identity through to the save path → existing source updates instead of adding a new micro copy row
- [ ] Salesforce review totals prefer fresh preview totals over stale stored totals in edit mode
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

## Journey 15: No GA4 Revenue Scenario

**Why**: Some GA4 properties don't track ecommerce revenue (e.g., lead-gen sites, content sites). This journey tests that the app handles $0 revenue correctly — Revenue/ROAS/ROI templates are disabled, insights don't reference revenue, and adding revenue manually later enables them.

### Step 1: Create campaign with no-revenue filter
- [ ] Click **New Campaign** → enter name: **"No Revenue Test"**
- [ ] Click **Next** → select **Google Analytics** → use **test data**
- [ ] In Step 4 (Configure): select the Yesop property, choose **90 days** lookback
- [ ] In the campaign filter: instead of selecting yesop campaigns, **type** `no_revenue_test` in the text input
- [ ] Click **Save & Continue** → **Create Campaign**

### Step 2: Navigate to GA4 Metrics
- [ ] Open the campaign → go to GA4 Metrics page
- [ ] Overview tab loads with simulation data

### Step 3: Verify Revenue = $0
- [ ] **Revenue = $0.00** — the `no_revenue` keyword in the filter causes simulation to zero out revenue
- [ ] **Sessions, Users, Conversions** — still populated (revenue flag doesn't affect these)
- [ ] **Spend = $0** — no spend added yet
- [ ] **ROAS, CPA, ROI = N/A** — cannot calculate without spend or revenue

### Step 4: Verify template gates
- [ ] Click **KPIs** tab → **Create KPI**
- [ ] **ENABLED**: Sessions, Users, Conversions, Engagement Rate, CR
- [ ] **DISABLED**: Revenue (no GA4 revenue), ROAS (needs spend + revenue), ROI (needs spend + revenue), CPA (needs spend)
- [ ] Close dialog

- [ ] Click **Benchmarks** tab → **Create Benchmark**
- [ ] Same pattern: Revenue/ROAS/ROI/CPA DISABLED
- [ ] Close dialog

### Step 5: Verify Insights
- [ ] Click **Insights** tab
- [ ] Executive Financials: Revenue = $0, Spend = $0
- [ ] **No revenue-related insights** should appear (no "Revenue Behind Target" etc.)
- [ ] Informational insights about sessions/engagement should still appear

### Step 6: Add manual revenue → templates unlock
- [ ] Go to **Overview** tab → click **"+"** on Revenue card
- [ ] Select **Manual** → enter **$10,000** → Save
- [ ] Revenue card now shows **$10,000**
- [ ] Click **KPIs** tab → **Create KPI**
- [ ] **Revenue** template — NOW ENABLED
- [ ] **ROAS/ROI** — still DISABLED (no spend yet)

### Step 7: Add manual spend → all templates unlock
- [ ] Go to **Overview** tab → click **"+"** on Spend card
- [ ] Select **Manual** → enter **$3,000** → Save
- [ ] Click **KPIs** tab → **Create KPI**
- [ ] **ROAS, ROI, CPA** — ALL NOW ENABLED
- [ ] Create a ROAS KPI to verify it calculates correctly

### Step 8: Delete revenue → Revenue/ROAS/ROI become blocked
- [ ] Go to **Overview** tab → delete the manual revenue source (trash icon)
- [ ] Revenue = $0 again
- [ ] Any Revenue/ROAS/ROI KPIs created in Step 7 → **"Blocked"** status
- [ ] KPI templates for Revenue/ROAS/ROI → DISABLED again
- [ ] CPA template → still ENABLED (only needs spend)

---

## Journey 16: Real Integration Tests (Requires Real Accounts)

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

## Fast Retest Matrix After A Code Fix

Use this instead of rerunning the full plan after every small fix:

- Overview-only bug:
  - affected Overview step
  - Journey 13 Cross-Tab Consistency
  - `Run Refresh` once if the bug touched calculations
- KPI bug:
  - affected KPI step
  - KPI Executive snapshot check
  - Insights KPI-related check
  - Journey 13 Cross-Tab Consistency
- Benchmark bug:
  - affected Benchmark step
  - Benchmark Executive snapshot check
  - Insights Benchmark-related check
  - Journey 13 Cross-Tab Consistency
- financial-source bug:
  - affected source add/edit/delete step
  - Overview financial cards
  - KPI and Benchmark financial cards
  - Insights financial row
  - Reports spot check
- refresh or recompute bug:
  - affected step
  - `Run Refresh`
  - KPI and Benchmark updates
  - Ad Comparison
  - Insights
  - Reports

---

## Final Checklist

### Part A: Mock Testing (Journeys 1-14)
1. Every number traces to a known source (simulation OR Run Refresh OR manual entry)
2. Run Refresh only adds GA4 data (sessions, conversions, revenue) — NOT spend
3. Spend arrives via Add Spend wizard, not Run Refresh
4. Spend/revenue changes propagate to ROAS/ROI/CPA/KPIs/Benchmarks/Insights
5. No cross-tab inconsistencies
6. Templates DISABLED when required data missing; ENABLED when data exists
7. Blocked KPIs excluded from scoring + show integrity insight
8. Notifications created when thresholds breached
9. All spend sources (Manual/CSV/Sheets/LinkedIn/Meta/Google Ads) work
10. All revenue sources (GA4/Manual/CSV/Sheets/HubSpot/Salesforce/Shopify) work
11. Total Spend = sum of micro copy (exact)
12. Total Revenue = GA4 onsite + CRM offsite (no double-counting)
13. Edit spend/revenue sources → no duplicates. Delete → recalculates.
14. Edit KPI → target/alert changes reflected on card, progress recalculates, insights update
15. Edit Benchmark → benchmark value changes reflected, status recalculates
16. Delete KPI → card removed, summary counts update, cascade deletes progress + alerts
17. Delete Benchmark → card removed, summary counts update, insights no longer reference it

### Part B: No Revenue Scenario (Journey 15)
18. Campaign with no GA4 revenue has Revenue/ROAS/ROI templates DISABLED
19. Adding manual revenue enables Revenue template; adding spend enables ROAS/ROI/CPA
20. Deleting revenue blocks Revenue/ROAS/ROI KPIs

### Part C: Real Integration Testing (Journey 16)
21. Each real platform connection completes OAuth successfully
22. Each platform's scheduler fetches real data and updates the DB
23. KPIs/Benchmarks/Insights recalculate after real scheduler runs
24. No stale data — values reflect the latest scheduler run
25. Alert notifications created for real threshold breaches
