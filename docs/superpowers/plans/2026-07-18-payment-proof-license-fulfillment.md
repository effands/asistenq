# Payment Proof and License Fulfillment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Connect MIXIN9, Member Web, Admin Web, and Telegram so payment proofs notify the owner, orders link to buyers, and approved payments can be fulfilled without duplicate licenses.

**Architecture:** Keep AsistenQ's store as the single source of truth. Add focused server helpers for member linking, proof-notification payloads, and idempotent fulfillment; expose them through existing HTTP routes; then make the Python bot and React UI consume those routes. MIXIN9 submits its detected HWID and always presents an explicit status dialog.

**Tech Stack:** TypeScript, Express, Zod, Vitest/Supertest, React, Python 3, unittest, PyQt5, Telegram Bot API.

---

## File Map

- Create `src/server/payment-proof-notifications.ts`: build and send owner Telegram proof notifications without coupling proof persistence to Telegram availability.
- Modify `src/server/services.ts`: normalize desktop order ownership and provide idempotent paid-order fulfillment.
- Modify `src/server/index.ts`: call proof notification after persistence and expose unified review/fulfillment routes.
- Modify `src/server/telegram-commerce.ts`: keep review transitions and fulfillment state deterministic.
- Modify `src/ui/App.tsx`: show member proof states and Admin Web review/fulfillment controls.
- Modify `src/ui/api.ts`: type fulfillment and proof-state responses.
- Modify `integrations/python/telegram_license_bot.py`: deep-link parsing, owner notifications, review follow-ups, and wizard cancellation.
- Modify `E:/AUTO KLIK/MIXIN9/core/license_client.py`: include detected HWID in desktop checkout.
- Modify `E:/AUTO KLIK/MIXIN9/gui/license_dialog.py`: show explicit status results.
- Extend existing TypeScript and Python test files listed below.

### Task 1: Link Desktop Orders and Capture HWID

**Files:**
- Modify: `src/server/services.ts`
- Modify: `src/server/index.ts`
- Test: `tests/services.test.ts`
- Test: `tests/telegram-commerce-routes.test.ts`

- [ ] **Step 1: Write failing service tests**

Add tests proving that `createLicenseCheckout` normalizes the input email, assigns `memberId` when an active member has the same normalized email, preserves the supplied 16-character HWID, and leaves unmatched orders unassigned.

- [ ] **Step 2: Run tests and verify the expected failures**

Run: `npm test -- tests/services.test.ts tests/telegram-commerce-routes.test.ts`

Expected: FAIL because desktop checkout does not yet link the matching member or retain the requested HWID in the tested path.

- [ ] **Step 3: Implement normalized member linking**

In the desktop checkout service, normalize with `email.trim().toLowerCase()`, locate an active matching member, and set:

```ts
memberId: matchedMember?.id,
customerEmail: normalizedEmail,
customerHwid: input.hwid?.trim().toUpperCase()
```

Keep the current idempotency behavior so retries reuse the same order.

- [ ] **Step 4: Run focused tests**

Run: `npm test -- tests/services.test.ts tests/telegram-commerce-routes.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/server/services.ts src/server/index.ts tests/services.test.ts tests/telegram-commerce-routes.test.ts
git commit -m "feat: link desktop invoices to member accounts"
```

### Task 2: Persist Proofs Before Telegram Notification

**Files:**
- Create: `src/server/payment-proof-notifications.ts`
- Modify: `src/server/index.ts`
- Test: `tests/payment-proof-notifications.test.ts`
- Test: `tests/telegram-commerce-routes.test.ts`

- [ ] **Step 1: Write failing notification tests**

Define tests for `buildPaymentProofNotification(order, context)` that assert invoice, buyer, product, plan, total, source, and these callback actions are present:

```ts
['proof_ok:<invoice>', 'proof_no:<invoice>', 'order:<invoice>']
```

Add a route test whose Telegram sender rejects and assert the upload still returns 200 with `paymentProofStatus: 'submitted'` and the store remains saved.

- [ ] **Step 2: Run tests and verify failure**

Run: `npm test -- tests/payment-proof-notifications.test.ts tests/telegram-commerce-routes.test.ts`

Expected: FAIL because the notification module and sender isolation do not exist.

- [ ] **Step 3: Implement the notification module**

Export a pure payload builder and an async sender. The sender reads the configured bot token and owner ID, sends the stored image with caption and inline keyboard through Telegram `sendPhoto`, and returns a structured result:

```ts
type NotificationResult = { delivered: boolean; error?: string };
```

Never throw from the public `notifyOwnerOfPaymentProof` boundary; log and audit delivery failure instead.

- [ ] **Step 4: Call notification only after persistence**

In desktop and member proof-upload routes, save the file and order first, send the HTTP success response from persisted state, and launch notification with handled rejection. Telegram-originated uploads retain the bot's existing direct owner notification and use the same caption/buttons.

- [ ] **Step 5: Run focused tests**

Run: `npm test -- tests/payment-proof-notifications.test.ts tests/telegram-commerce-routes.test.ts`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/server/payment-proof-notifications.ts src/server/index.ts tests/payment-proof-notifications.test.ts tests/telegram-commerce-routes.test.ts
git commit -m "feat: notify telegram owner of payment proofs"
```

### Task 3: Unified Review and Idempotent Fulfillment

**Files:**
- Modify: `src/server/services.ts`
- Modify: `src/server/telegram-commerce.ts`
- Modify: `src/server/index.ts`
- Test: `tests/services.test.ts`
- Test: `tests/telegram-commerce.test.ts`
- Test: `tests/telegram-commerce-routes.test.ts`

- [ ] **Step 1: Write failing fulfillment tests**

Cover these transitions:

```text
submitted -> approve -> paid
paid + HWID + license product -> create exactly one license
repeated fulfillment -> reuse the same license
paid + no HWID -> needs_hwid
paid + download product -> create/reuse download grant
rejected -> retain rejection reason
```

- [ ] **Step 2: Run tests and verify failure**

Run: `npm test -- tests/services.test.ts tests/telegram-commerce.test.ts tests/telegram-commerce-routes.test.ts`

Expected: FAIL on the missing unified/idempotent result states.

- [ ] **Step 3: Implement `fulfillApprovedOrder`**

Return one discriminated response:

```ts
type FulfillmentResult =
  | { kind: 'license'; license: License; reused: boolean; buyerTelegramId?: string }
  | { kind: 'needs_hwid'; order: Order }
  | { kind: 'download'; grant: DownloadGrant; reused: boolean };
```

Reuse `order.licenseId` or the existing order license before generating. Reuse an active download grant before creating another.

- [ ] **Step 4: Expose review and fulfillment routes**

Keep the owner-bot review route and add Admin Web equivalents that require the `orders` scope. Return `nextAction` after approval and a separate idempotent fulfillment endpoint for generate/activate/resend.

- [ ] **Step 5: Run focused tests**

Run: `npm test -- tests/services.test.ts tests/telegram-commerce.test.ts tests/telegram-commerce-routes.test.ts`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/server/services.ts src/server/telegram-commerce.ts src/server/index.ts tests/services.test.ts tests/telegram-commerce.test.ts tests/telegram-commerce-routes.test.ts
git commit -m "feat: add idempotent order fulfillment"
```

### Task 4: Telegram Deep Links and Owner Actions

**Files:**
- Modify: `integrations/python/telegram_license_bot.py`
- Modify: `tests/test_telegram_bot.py`
- Modify: `tests/telegram_bot_response_test.py`

- [ ] **Step 1: Write failing bot tests**

Test `/start invoice_<encoded invoice>` parsing, cancellation of an unrelated owner pending wizard, proof notification buttons, approve follow-up for `license`, `needs_hwid`, and `download`, plus resend behavior for an existing license.

- [ ] **Step 2: Run tests and verify failure**

Run: `python -m unittest tests.test_telegram_bot tests.telegram_bot_response_test -v`

Expected: FAIL because `/start` ignores payloads and approval does not render all next actions.

- [ ] **Step 3: Implement deep-link resolution**

Parse only the strict payload format `invoice_<URL-safe token>`, resolve it through the authenticated buyer API, and never grant access based only on the payload. Clear incompatible pending state before processing owner invoice actions.

- [ ] **Step 4: Implement owner follow-up keyboards**

After approval, render one of:

```text
Generate & Kirim Lisensi
Menunggu HWID Pembeli
Aktifkan Download
Kirim Ulang Lisensi
```

Include `Buka Admin Web` as a URL button on proof/detail messages.

- [ ] **Step 5: Run Python tests**

Run: `python -m unittest tests.test_telegram_bot tests.telegram_bot_response_test -v`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add integrations/python/telegram_license_bot.py tests/test_telegram_bot.py tests/telegram_bot_response_test.py
git commit -m "feat: complete telegram payment review flow"
```

### Task 5: Admin and Member Web Status UX

**Files:**
- Modify: `src/ui/api.ts`
- Modify: `src/ui/App.tsx`
- Modify: `src/ui/styles.css`
- Test: `tests/member-payment-flow-ui.test.ts`

- [ ] **Step 1: Write failing UI contract tests**

Assert that Admin Orders exposes proof review, rejection reason, generate/activate/resend actions, and that Member Orders renders `submitted`, `rejected`, and approved states. Assert the invoice modal builds a bot deep link rather than `t.me/share/url`.

- [ ] **Step 2: Run tests and verify failure**

Run: `npm test -- tests/member-payment-flow-ui.test.ts`

Expected: FAIL on missing controls and the legacy generic share URL.

- [ ] **Step 3: Implement typed API actions and notices**

Add typed review/fulfillment results, use existing `apiRequest`, refresh order data after every mutation, and show explicit success/error notices. Keep actions disabled while their request is in flight.

- [ ] **Step 4: Implement member proof states and deep link**

Display the proof status and rejection reason in Member Orders. Construct the Telegram bot URL from the configured public bot username and a short invoice payload; if no bot username is configured, show upload/status guidance without a broken link.

- [ ] **Step 5: Run UI and layout tests**

Run: `npm test -- tests/member-payment-flow-ui.test.ts tests/member-order-layout.test.ts`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/ui/api.ts src/ui/App.tsx src/ui/styles.css tests/member-payment-flow-ui.test.ts
git commit -m "feat: add web payment review and fulfillment controls"
```

### Task 6: MIXIN9 Checkout and Status Feedback

**Files:**
- Modify: `E:/AUTO KLIK/MIXIN9/core/license_client.py`
- Modify: `E:/AUTO KLIK/MIXIN9/gui/license_dialog.py`
- Modify: `E:/AUTO KLIK/MIXIN9/tests/test_license_client.py`
- Create: `E:/AUTO KLIK/MIXIN9/tests/test_license_dialog_status.py`

- [ ] **Step 1: Write failing MIXIN9 tests**

Assert `create_order` includes the detected uppercase HWID and that the status-message formatter maps `none`, `submitted`, `rejected`, paid-without-license, and license-ready states to clear Indonesian messages.

- [ ] **Step 2: Run tests and verify failure**

Run from `E:/AUTO KLIK/MIXIN9`: `python -m unittest tests.test_license_client tests.test_license_dialog_status -v`

Expected: FAIL because HWID is omitted and status refresh has no success dialog.

- [ ] **Step 3: Include detected HWID**

Set the desktop request field to:

```py
"hwid": (hwid or get_hwid()).strip().upper()
```

The application continues detecting it automatically; no checkout input is added.

- [ ] **Step 4: Add explicit status feedback**

Extract a pure status-message formatter. After every successful `get_order_status`, render the order and call `show_message` with the matching informational, warning, rejection, approval, or license-ready message.

- [ ] **Step 5: Run MIXIN9 tests**

Run: `python -m unittest tests.test_license_client tests.test_license_dialog_status -v`

Expected: PASS.

- [ ] **Step 6: Build the executable after all integration tests pass**

Use the project's existing spec/build command and verify the resulting executable launches and displays the updated license dialog.

### Task 7: Full Verification and Deployment

**Files:**
- Verify all changed files; do not add unrelated generated artifacts unless the repository tracks them intentionally.

- [ ] **Step 1: Run complete AsistenQ tests**

Run: `npm test`

Expected: all Vitest files pass.

- [ ] **Step 2: Run complete Python bot tests**

Run: `python -m unittest discover -s tests -p "test*.py" -v`

Expected: all bot tests pass.

- [ ] **Step 3: Build AsistenQ production artifacts**

Run: `npm run build`

Expected: TypeScript, Vite, and server bundle succeed.

- [ ] **Step 4: Verify MIXIN9 against the deployed API**

Create a fresh test invoice, confirm it appears in the matching Member Orders page, upload a proof, confirm the owner receives the Telegram photo, approve it, generate/send the license, and confirm `Cek Status` receives the token.

- [ ] **Step 5: Verify website purchase without HWID**

Create a member checkout without HWID, approve the proof, verify the buyer is prompted for HWID only after payment, and fulfill the license after submission.

- [ ] **Step 6: Deploy and restart both services**

Pull the verified commit on the server, rebuild/restart the Node application, restart the Telegram bot so it loads the new Python code, then repeat proof-notification and fulfillment smoke tests on production.

- [ ] **Step 7: Final commit if deployment metadata is tracked**

```bash
git status --short
git log -1 --oneline
```

Expected: only pre-existing user-owned changes remain.
