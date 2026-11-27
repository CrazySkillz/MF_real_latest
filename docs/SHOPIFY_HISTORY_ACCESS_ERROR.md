# Shopify historical-order access failure

## Scope and cause

On 27 November 2026 the saved September 28 order in Batch 1 Provider Check
fell outside the recent-order window of its OAuth connection. Its saved grant
contains `read_orders`, not `read_all_orders`. Rejecting that refresh preserves
the previous complete revenue; it is not a reason to shorten the reporting
window or bypass the access check.

The Shopify save-mappings route correctly returned HTTP 409 with
`SHOPIFY_READ_ORDERS_CAMPAIGN_WINDOW_EXCEEDED`. The owned financial scheduler
discarded that code and the daily scheduler recorded a generic GA4 provider
failure. Preserve only this recognized code from the Shopify route, without
copying arbitrary response details into durable errors. Other provider errors,
retry policies, calculations, source replacement and publication gates are unchanged.

The existing Shopify setup warning now explains the required historical access
and reconnection. It no longer claims an approval request is pending, which the
app cannot establish. The general GA4 publication-status subtitle is unchanged.

## Validation boundary

Regression coverage exercises the real route rejecting an aged-out saved order,
preserving revenue and resuming once the connection has `read_all_orders`;
the financial request's sanitized error classification; the owned pipeline's
non-retryable release with no GA4 fetch or downstream publication; and the
existing browser warning and disabled Continue action.

The merchant/app administrator must obtain historical-order access, configure
the approved scope and reauthorize the store. Code deployment alone cannot grant
Shopify permissions. No campaign deletion, activation change, provider refresh,
schedule change or saved-data cleanup is part of this correction. An actual
authorized Shopify refresh after reauthorization remains unverified until it runs.
