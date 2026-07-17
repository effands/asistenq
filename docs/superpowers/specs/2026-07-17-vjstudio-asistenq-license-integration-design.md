# VJ STUDIO and AsistenQ License Integration Design

**Date:** 2026-07-17  
**Status:** Approved for planning  
**Repositories:** `E:\asistenq` and `E:\FIX TOOLS YT\VJSTUDIO`

## Objective

Make AsistenQ the single source of truth for VJ STUDIO product configuration, pricing, vouchers, payment orders, QRIS, payment review, licenses, device bans, and customer-facing notices. VJ STUDIO must retrieve the current configuration automatically while retaining safe offline fallbacks and compatibility with previously issued licenses.

## Product Definition

- Product name: **VJ Studio PRO**
- Product slug: `vjstudio`
- Product type: desktop tool
- Payment verification: manual by an AsistenQ administrator
- Device binding: one HWID per license

Only these paid plans are active:

| Code | Name | Duration | Price | Badge |
| --- | --- | ---: | ---: | --- |
| `1M` | 1 Bulan | 30 days | Rp49.900 | - |
| `3M` | 3 Bulan | 90 days | Rp129.900 | - |
| `6M` | 6 Bulan | 180 days | Rp225.900 | Best Seller |
| `1Y` | 1 Tahun | 365 days | Rp399.000 | - |

`TRIAL`, `2M`, and `LIFETIME` are inactive and must not be returned to customers. Existing licenses that were issued under an inactive or retired plan remain valid until their recorded expiry date. Existing lifetime licenses remain valid, but no new lifetime purchase is offered.

## Recommended Delivery Strategy

Use a staged migration with one target architecture:

1. Centralize product plans, prices, badges, vouchers, announcements, device bans, and license generation in AsistenQ.
2. Point VJ STUDIO at the AsistenQ public license API with a local read-only fallback configuration.
3. Move checkout to AsistenQ orders so each transaction receives a server-generated unique amount and dynamic QRIS.
4. Retire the legacy activation server and GitHub JSON database after the compatibility period.

This limits customer disruption while avoiding two permanent sources of truth.

## AsistenQ Admin Design

### Product management

The existing product editor gains a plan-management section for existing products. An administrator can:

- create a plan;
- edit its name, price, duration, badge, and display order;
- activate or deactivate it;
- select one highlighted plan such as `Best Seller`;
- preview the plans exactly as customers will see them.

Plan codes are stable identifiers. Editing a plan must not change its code or invalidate licenses and orders already linked to it. A plan referenced by historical data is retired by setting `isActive` to false, not deleted.

### Commerce and payment management

The administrator configures the merchant QRIS payload once in AsistenQ. VJ STUDIO never stores the merchant payload or constructs payment data independently.

For every checkout AsistenQ creates a pending order containing:

- invoice number;
- product and plan identifiers;
- customer email;
- HWID;
- base price;
- voucher discount, if any;
- three-digit unique payment code;
- final payable amount;
- dynamic QRIS image or payload;
- expiry time;
- payment-review status.

The administrator can approve or reject submitted payment evidence from the web admin or owner Telegram bot. Approval generates the VJ STUDIO license once. Repeated approval requests must return the existing license instead of generating duplicates.

### Voucher management

Vouchers are managed only in AsistenQ. Validation checks product scope, active state, expiry, usage limit, and discount rules. A voucher is reserved or consumed by the order workflow so the desktop application cannot increment usage directly.

## Public API Contract

VJ STUDIO uses HTTPS endpoints on `https://asistenq.com`. Product-specific endpoints explicitly identify `vjstudio` even where legacy aliases remain available.

### Configuration

`GET /api/license/products/vjstudio/config`

Returns a versioned document containing:

- active plans in display order;
- plan code, name, price, duration, badge, and highlighted state;
- current announcement;
- checkout expiry information;
- Telegram support/contact URL;
- a configuration version and update timestamp.

Inactive plans are never included.

### Voucher validation

`POST /api/license/vouchers/validate`

Input includes product slug, plan code, and voucher code. The server returns the calculated discount and payable base amount. The client treats this as a preview; the order endpoint recalculates all amounts authoritatively.

### Checkout creation

`POST /api/license/orders`

Input includes product slug, plan code, email, HWID, and optional voucher code. The response returns the invoice, final amount, unique code, QRIS data, expiry time, and payment instructions.

Repeated requests with the same client idempotency key return the same pending order.

### Payment evidence and status

- `POST /api/license/orders/:invoice/payment-proof`
- `GET /api/license/orders/:invoice/status`

The status response exposes only customer-safe order and license-delivery information. It must not expose internal secrets or unrelated customer data.

### License activation and verification

- `POST /api/license/activate`
- `POST /api/license/verify`
- `GET /api/license/banned?product=vjstudio`

The existing legacy aliases may remain during migration, but new VJ STUDIO builds use the explicit endpoints.

## VJ STUDIO Desktop Design

### Configuration loading

On opening the license dialog, VJ STUDIO requests the AsistenQ configuration in a background thread. The UI remains responsive and initially displays the last valid cached configuration. A successful response replaces the plan buttons and updates the cache atomically.

The embedded fallback contains only the four approved plans. It is used when no cache exists and the server cannot be reached. Server responses are validated before rendering; malformed or empty responses do not overwrite a valid cache.

The six-month plan receives its `Best Seller` presentation from server data rather than a hard-coded `6M` condition.

### Checkout flow

Selecting a plan and entering an email requests an AsistenQ order. VJ STUDIO displays the QRIS returned for that order, the exact payable amount including its three-digit unique code, invoice number, expiry time, and Telegram support action.

The client does not calculate final prices, consume vouchers, or generate unique codes. It may display provisional values, but AsistenQ is authoritative.

After payment, the customer can submit evidence and poll order status. When an administrator approves the order, the status response delivers the generated token and the activation form can populate it automatically.

### License compatibility

Previously issued date-signature tokens continue to pass local validation. New licenses remain compatible with the current token format during this migration, but generation occurs only in AsistenQ.

Online activation and verification provide server-side status and ban enforcement. A temporary offline grace behavior preserves access during short outages for a locally valid, previously activated license. The grace behavior must not extend a license past its encoded or server-recorded expiry date.

The hidden legacy perpetual token remains supported only for existing installations during migration and is not documented or issued to new customers. Its removal requires a separately approved customer migration.

## Legacy File Responsibilities

### `vjstudio.py`

- replace the old IP-based API default with the AsistenQ HTTPS API;
- consume the versioned configuration and order endpoints;
- render server-driven packages and badges;
- use order-specific dynamic QRIS;
- preserve local fallback and old-license validation;
- stop treating locally calculated price and unique code as authoritative.

### `activation_server.py`

- stop being the primary database;
- remove GitHub synchronization and all embedded credentials;
- during migration, either proxy the narrow legacy endpoints to AsistenQ or be disabled once deployed clients use AsistenQ directly;
- never write licenses, vouchers, or package data independently.

### `generate_license.py`

- remain as an optional administrative compatibility CLI;
- request license generation from an authenticated AsistenQ admin endpoint;
- contain no license salt, server secret, GitHub token, or independent database writes;
- clearly reject retired plan codes for new licenses.

### `license_bot.py` and `generator_lisensi.html`

These legacy management interfaces are no longer authoritative. Their package, voucher, ban, and license mutations are replaced by AsistenQ admin and the AsistenQ Telegram owner bot. They can be archived only after operational verification confirms that no deployment still depends on them.

## Security Requirements

- Revoke the GitHub personal access token found in the legacy source and replace it nowhere in client code.
- Store AsistenQ secrets only in server environment variables or protected server settings.
- Use HTTPS for every desktop-to-AsistenQ request.
- Rate-limit public verification, voucher, checkout, proof-upload, and status endpoints.
- Validate image type and size for payment evidence.
- Prevent price tampering by recalculating plans, discounts, and final amounts on the server.
- Use idempotency for order creation, payment approval, and license issuance.
- Do not log complete tokens, QRIS merchant payloads, credentials, or customer secrets.
- Keep admin and bot mutation endpoints authenticated and separate from public customer endpoints.

## Data Migration

1. Back up the AsistenQ store and the legacy license database.
2. Match the VJ STUDIO product by slug `vjstudio`.
3. Preserve existing licenses, HWIDs, activation states, and expiry dates.
4. Deactivate `TRIAL`, `2M`, and `LIFETIME` for new purchases.
5. Upsert the four approved plans with exact prices and durations.
6. Mark `6M` as the highlighted `Best Seller` plan.
7. Import still-valid vouchers and banned HWIDs once, resolving duplicates by normalized code or HWID.
8. Record a migration report with imported, skipped, and conflicting rows.

No source record is deleted during migration.

## Failure Handling

- If configuration retrieval fails, VJ STUDIO uses its last valid cache or embedded fallback and shows a discreet offline notice.
- If order creation fails, no QRIS or guessed payable amount is shown as a valid transaction.
- If QRIS generation fails, the order remains pending and the client offers retry without creating another order.
- If evidence upload fails, the selected file remains available for retry.
- If approval succeeds but delivery fails, polling the same invoice retrieves the already-generated license.
- If legacy and AsistenQ data conflict, AsistenQ is authoritative after the recorded cutover time; conflicts are reported for manual review.

## Verification Strategy

### AsistenQ tests

- plan CRUD, retirement, ordering, and badge serialization;
- only the four active VJ STUDIO plans appear publicly;
- voucher validation and server-side recalculation;
- three-digit unique amount allocation without collision among active orders;
- dynamic QRIS amount matches the final order amount;
- checkout idempotency;
- manual approval creates exactly one license;
- expired, rejected, banned, and already-paid paths;
- authorization and file-upload limits.

### VJ STUDIO tests

- online configuration replaces cached/fallback plans;
- malformed or failed configuration requests preserve the valid cache;
- server-provided Best Seller badge renders correctly;
- order QRIS, amount, invoice, and expiry render from the same response;
- retired plans cannot be selected;
- old time-limited licenses continue working;
- offline grace never extends expiration;
- UI stays responsive during network operations.

### Deployment acceptance

- admin edits a price and a fresh VJ STUDIO dialog displays it without rebuilding the desktop application;
- admin deactivates a plan and it disappears from a fresh configuration response;
- a test customer creates an order, scans the QRIS for the exact unique amount, submits evidence, and receives one valid license after manual approval;
- web admin and Telegram owner bot show the same order and final state;
- the old activation service can be stopped without affecting the updated desktop build.

## Rollout and Rollback

Deploy additive AsistenQ schema and API changes first, followed by admin UI, then a VJ STUDIO test build. Migrate data only after backups. Run a controlled end-to-end transaction before releasing the desktop update.

During the compatibility window, rollback consists of restoring the prior VJ STUDIO API base and keeping the legacy service read-only. AsistenQ data created during testing is retained and marked as test data rather than silently deleted. The legacy service is retired only after updated clients and production transactions are verified.

