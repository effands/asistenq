# Payment Proof Cleanup and Direct License Design

## Objective

Protect AsistenQ hosting storage from repeated payment-proof uploads and let the Telegram owner create a VJ Studio license directly without first creating an order.

## Scope

This change covers two owner-only workflows:

1. Payment-proof file cleanup from the web admin order page.
2. Direct license creation and optional delivery from the Telegram owner bot.

Order history, payment records, and existing paid licenses must not be deleted by proof-file cleanup.

## Payment-Proof Storage Controls

### Per-order cleanup

Each order that has an uploaded desktop payment proof exposes an admin-only `Hapus Bukti` action. The action requires confirmation. It deletes the physical file, clears the stored file reference and submission timestamp, and changes a pending order's proof status from `submitted` to `none`. Approved or rejected order/payment history remains unchanged even when its physical proof file is removed.

### Bulk cleanup

The admin order page exposes `Bersihkan Semua Bukti Upload`. It requires confirmation and calls an owner/admin endpoint protected by the existing `orders` scope. The server deletes all regular files inside `data/payment-proofs`, clears matching file references, and returns the number of files and total bytes removed. The UI reports those values and refreshes the order list.

The cleanup operation is idempotent: running it when no files exist returns zero files and zero bytes without failing.

### Replacement behavior and upload constraints

Desktop uploads remain limited to one JPG, PNG, or WebP image of at most 5 MB. When an invoice already has a desktop proof, a successful replacement upload deletes the previous local file after the new upload has been validated. Files are resolved through `path.basename` and may only be deleted from the configured payment-proof directory.

## Direct Telegram License Creation

### Owner flow

The existing owner button `Buat/Kirim Lisensi` starts a direct flow independent of orders:

1. Select an active licensed product.
2. Select an active plan.
3. Enter the customer email.
4. Enter the 16-character alphanumeric HWID.
5. Review the product, plan, email, and HWID.
6. Confirm license creation.

The server uses the existing license generator and stores the resulting license in the AsistenQ database with no order ID. The bot always displays the generated token, expiry, product, plan, email, and HWID to the owner.

### Optional buyer delivery

After creation, the bot looks up an active member whose normalized email matches the license email and whose Telegram ID is present. When found, the owner response includes `Kirim ke Pembeli`. Pressing it sends the license details to that Telegram user. When no linked Telegram account exists, the bot clearly says that the token must be copied and sent manually.

The token is never sent automatically. Delivery always requires the owner's explicit button press.

### Duplicate protection

Before creation, the server checks for an active license with the same product, normalized email, and normalized HWID. If one exists, the confirmation response warns the owner and returns the existing license rather than silently creating a duplicate. A different plan or an expired/revoked license may be replaced only through a new explicit confirmation.

## Authorization and Errors

- Cleanup routes require an authenticated admin with `orders` scope.
- Direct license creation and delivery routes require the configured Telegram owner identity and bot secret.
- Missing files are treated as already cleaned.
- Invalid email, HWID, product, or plan returns a concise Telegram message without exposing server internals.
- Telegram delivery failure does not delete or roll back a license that was already created; the owner retains the displayed token for manual delivery.

## Verification

Focused automated tests cover:

- replacement upload removes the previous file reference/file;
- per-order cleanup deletes only the selected proof;
- bulk cleanup reports files and bytes and preserves orders;
- direct creation works without an order;
- duplicate creation returns the existing active license;
- delivery is offered only for a linked Telegram member;
- non-owner and insufficient-scope requests are rejected.

Manual verification covers the two admin cleanup buttons and the complete Telegram owner flow through token display and optional buyer delivery.
