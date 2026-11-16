# Colombian Coffee sampled mixed-date traffic recovery

## Confirmed cause

On 16 November 2026, the scheduled Colombian Coffee request for property 425831989 and the saved coffee_bags/served_here scope failed in getDistinctUsersWithToken. The request combined sessionCampaignName through 15 November with pageLocation UTM matches for 16 November. Actual GA4 metadata reported 12,153 events sampled from 12,164. The sampled aggregate was 25 Sessions and 5 Users. The quality guard correctly rejected it. The daily-presence and existing Landing Pages zero-conversion recovery passed independently; neither caused this failure.

Equivalent date-filter rewrites remained sampled. An independent, unsampled eventCount request for the exact UTM tail returned no events. An unsampled native aggregate of the remaining session-campaign scope returned 26 Sessions, 5 Users, 18 Engaged Sessions, engagementRate 0.6923076923076923 and sessionKeyEventRate 0. No synthetic provider response, import or campaign refresh was used to establish those results. Google exposes the sample ratio but not its internal choice of sampling plan.

## Smallest supported recovery

Only getDistinctUsersWithToken changes. After a sampling-only rejection of a mixed-date aggregate, it asks GA4 to prove that the entire fallback tail for the exact saved campaigns contains zero events. Every response still passes the existing shared quality gate. A valid zero permits removing that empty branch and querying the earlier portion directly. Whole-period Users, Sessions and rates remain native provider values, never daily sums. The requested publication dates remain unchanged, and the proven empty dates stay zero in daily output. Each selected campaign and comparison window is still independently queried.

Positive, missing, malformed, incomplete, sampled, thresholded or inaccessible proof fails closed. Recovery aggregates remain subject to all existing completeness, sampling, thresholding, restrictions and value checks. Non-sampling errors do not enter recovery. There is no general recovery for a sampled mixed scope whose tail contains events, and no accuracy threshold was relaxed.

## Evidence and boundaries

Read-only isolated Render jobs reproduced the failure and verified the candidate with real GA4 responses. The campaign and publication fingerprint stayed dd4d26c882c4374bce2c26e8bd69ba5baf91c294d11aa86786edc678a76cdf21 across diagnostics. The live publication still ends on 15 November; no failed work bookkeeping was cleared. The 16 November scheduled failure must remain visible until an ordinary scheduled refresh succeeds.

The recorded fixture covers the actual sampled requests, zero-event proof, unsampled totals, daily users, campaign totals and comparison windows. Targeted negative tests retain failure for every unsupported proof/recovery case. Existing distinct-users, period-sessions, presence-sampling and Landing Pages sampling regressions passed (53), plus 13 new real-response recovery/negative cases. Required release checks and any deployment are recorded separately in audit-temp/colombian-sampling-20261116/state.json. This evidence is not a claim that all campaigns, lifecycle paths or current on-screen/PDF outputs were revalidated.
