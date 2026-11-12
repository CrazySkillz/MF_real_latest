# Shopify revenue definition on Review Settings

Scope: remove the redundant Shopify revenue-definition screen. Shopify already uses the fixed `current_total_price` metric, so this screen contains no user choice.

The flow is now Campaign field → Crosswalk → Review Settings. Both the wizard Back button and outer modal Back return from Review to Crosswalk. Review retains the full explanation: “Current total price after returns, refunds, and order adjustments.”

Only the two frontend components change. Preview/save requests, the revenue metric, calculations, storage, source IDs, provider reads, schedules and existing data remain unchanged. Existing browser tests follow the shorter flow and check the unchanged save fields; integrated add/edit modal checks cover both Back controls and selection preservation. Existing stale-preview and currency checks remain in place.

Deployment scope: Render test app only, after required checks pass. The live app remains on its existing revision. Release checks and hosted verification are recorded in the release receipt; this note alone is not deployment evidence.
