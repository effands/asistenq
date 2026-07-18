# License Device Reset and Order Safety Design

## Goal

Prevent duplicate desktop checkout invoices, make device migration safe and understandable, and let members quickly filter order and license histories by operational status.

## Scope

This change covers the AsistenQ license checkout API, the MIXIN9 license dialog, member device reset, member order filters, member license filters, reset notifications, and cleanup of confirmed test duplicates. It does not change product pricing, QRIS generation, payment approval, license duration, or administrator authority to reset a device.

## Desktop checkout safety

The server is the source of truth. A pending, unexpired order is reusable when product, plan, normalized email, and normalized HWID match, even if the desktop client sends a new idempotency key. The response must return the access token derived from the reusable order's stored idempotency key so proof upload and status polling continue to authenticate correctly.

Before creating an order, the server checks for an unexpired license for the same product, normalized email, and HWID. If one exists, checkout is rejected with a stable, user-facing message that the device already has a valid license. A renewal remains available through the website and is not silently represented as a new desktop purchase.

MIXIN9 adds client-side defense in depth. While an order is pending, repeated clicks reuse and display that invoice instead of creating another. Once a valid license token is found, the invoice button is disabled and labeled `Lisensi Sudah Aktif`. The server checks remain mandatory because a modified or older client can bypass interface controls.

## Device migration

A member may reset a license to a different 16-character alphanumeric HWID at most two times in a rolling seven-day window. Only successful member-initiated changes consume quota. Entering the current HWID, validation failures, and administrator resets do not consume quota.

Each successful reset records a device-reset event containing the license ID, old HWID, new HWID, actor type, actor ID, and timestamp. The quota is calculated from member-initiated successful events for that license whose timestamp is within the preceding seven days. Administrator resets remain unrestricted but are still recorded for audit.

The reset keeps the same license and original expiration date. It invalidates the old device, generates a new token for the new HWID, clears activation state, and sets the license to generated/not-yet-activated. It never creates an invoice or extends the subscription.

The member license row displays `Sisa reset minggu ini: N dari 2`. Before submission it explains that the old device will stop working. After success it shows that the HWID was changed and instructs the member to copy the newest token into the new device. At quota exhaustion, the reset controls are disabled and the page shows the earliest date and time at which another reset becomes available, plus guidance to contact the administrator for exceptional cases.

MIXIN9 treats a server response indicating a mismatched or replaced device as a device-migration condition. It explains that the device has changed and directs the user to retrieve the latest token from Area Member instead of prompting them to buy another license.

## Member order filtering

The order page adds a compact search field and four status controls with counts:

- `Semua`: every order owned by the member.
- `Sukses`: paid or approved orders.
- `Pending`: orders awaiting payment or payment-proof review.
- `Dibatalkan`: cancelled and expired orders.

Search matches invoice number and product name. Filtering and search compose together and operate on the already-authorized member dataset. The result count reflects the active combination. A clear empty state explains when no order matches. Existing four-column desktop cards and responsive mobile behavior are preserved.

## Member license filtering

The license page retains search and exposes explicit filters for `Semua`, `Aktif`, `Belum Diaktivasi`, and `Kedaluwarsa`, each using the normalized license status and expiration time. Device-reset quota information appears only inside the expanded license row to keep dense lists scalable.

## Duplicate test-data cleanup

Cleanup is a one-time, production-safe operation performed only after a backup and a read-only preview. It targets pending MIXIN9 orders belonging to the confirmed test account and HWID that were created by repeated invoice clicks after the successful licensed order. Paid, approved, proof-submitted, unrelated-account, unrelated-product, and license-linked orders are excluded. The exact invoice numbers are reported before and after cleanup.

## Error handling and notifications

API errors use stable Indonesian messages for: active license already exists, pending invoice reused, reset quota exhausted, invalid HWID, and unchanged HWID. The website shows inline notices without losing the entered value. MIXIN9 prevents concurrent invoice requests by disabling its action while a request is running and always restores the control on failure.

## Data compatibility

The reset-event collection is optional when older data is loaded and defaults to an empty list. Existing licenses and orders require no migration. Status grouping must recognize all existing persisted status values and map unknown non-success states to `Pending` only when they are still payable; terminal unknown states remain outside success and pending counts but continue to appear under `Semua`.

## Testing and verification

Server tests must first reproduce different-idempotency-key duplicate clicks, active-license checkout, two allowed resets, the third reset rejection, rolling-window recovery, unchanged-HWID behavior, admin reset exemption, audit records, and preservation of expiration. UI tests cover order status mapping, combined search/filter behavior, quota notices, and disabled controls. MIXIN9 tests cover pending-order reuse, active-license button state, request-in-flight protection, and device-migration messaging.

Verification includes focused tests, the full AsistenQ test suite and build, focused MIXIN9 tests, a rebuilt Windows executable, production deployment health checks, live creation/reuse of one pending test invoice, and live confirmation that an active license cannot generate more desktop invoices.
