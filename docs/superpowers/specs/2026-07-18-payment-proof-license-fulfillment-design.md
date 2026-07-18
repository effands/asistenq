# Payment Proof and License Fulfillment Design

## Goal

Make payment confirmation reliable across MIXIN9, the member website, the admin website, and the Telegram bot. A submitted proof must be visible to the buyer and admin, notify the Telegram owner immediately, and lead to a short, explicit fulfillment flow.

## Single Source of Truth

- Products, plans, prices, orders, payment proofs, members, and licenses remain in the AsistenQ store.
- The Telegram bot reads and writes the same product and plan records used by Admin Web.
- A product created or edited from Telegram appears in Admin Web, and Admin Web changes are reflected by Telegram without a duplicate Telegram-only catalog.

## Desktop Checkout

- MIXIN9 creates its invoice with product slug, plan code, buyer email, idempotency key, and the HWID detected by the application.
- The buyer is not asked to type an HWID during checkout.
- If an active member has the same normalized email, the new desktop order is assigned to that member so it appears in Member Orders.
- Existing secure order-token authorization continues to protect status checks and proof uploads.

## Website Checkout

- Website checkout continues without an HWID.
- The order belongs to the authenticated member.
- After approval, a license order without an HWID prompts the buyer in Member Licenses to submit it.
- License generation is enabled only after payment approval and a valid HWID are both available.

## Payment Proof Submission

When a valid proof is uploaded from MIXIN9, Member Web, or Telegram:

1. Store or associate the proof with the order.
2. Set `paymentProofStatus` to `submitted` and record the submission timestamp.
3. Persist the change before attempting external notifications.
4. Send the Telegram owner a proof notification containing the image, invoice, buyer, product, plan, total, and source.
5. Add inline actions: `Setujui`, `Tolak`, `Detail`, and `Buka Admin Web`.

Telegram notification failure must not undo a successful proof submission. It must be logged and the buyer must still receive a successful proof-submission response.

## Telegram Owner Flow

- Proof notifications go directly to the configured Telegram owner ID.
- Opening or acting on an invoice cancels any unrelated pending owner wizard state so invoice text cannot be consumed as a product slug.
- `Setujui` marks the order paid and exposes the appropriate next action:
  - License product with stored HWID: `Generate & Kirim Lisensi`.
  - License product without HWID: show that the buyer must submit an HWID first.
  - Download product: `Aktifkan Download`.
- After a license exists, the action becomes `Kirim Ulang Lisensi` and must reuse the existing license instead of creating duplicates.
- `Tolak` asks for a reason and stores it for the buyer.
- `Buka Admin Web` targets the order detail in Admin Web.

## Admin Web Flow

Order detail exposes the same state and actions as Telegram:

- View proof.
- Approve or reject with a reason.
- Generate and send a license when paid and an HWID is present.
- Activate a download grant for download products.
- Resend an existing license without regenerating it.

All actions are idempotent and display an explicit success or error notice.

## Buyer Status Experience

MIXIN9 `Cek Status` always displays a dialog after a successful request:

- `none`: payment proof has not been submitted.
- `submitted`: proof received and waiting for admin review.
- `rejected`: proof rejected, including the stored reason.
- `approved` / paid without license: payment accepted and license preparation in progress.
- License present: token received and ready to activate.

Member Orders shows the same proof state and rejection reason. A refreshed desktop-linked order appears for a member whose normalized email matches the invoice email.

## Telegram Buyer Link

- Replace the generic Telegram share URL with a bot deep link containing a short, validated invoice payload.
- `/start <payload>` resolves the invoice and offers buyer actions without entering an owner product wizard.
- Ownership-sensitive actions still require a Telegram account linked to the matching member; the payload alone grants no order access.

## Validation and Security

- Normalize email before member matching.
- Validate HWID using the existing 16-character alphanumeric rule.
- Keep proof file type and size limits.
- Require owner identity for approval, rejection, generation, download activation, and resend actions.
- Do not expose order access tokens in Telegram messages or Admin Web URLs.
- Prevent duplicate proof notifications for an identical already-submitted proof where practical.
- Audit proof submission, notification attempt, review, fulfillment, and resend events.

## Testing

- Server tests cover desktop HWID capture, normalized member linking, proof persistence, notification payload construction, notification failure isolation, approval, and idempotent fulfillment.
- Telegram bot tests cover deep-link parsing, wizard cancellation, owner proof notification buttons, approval follow-up actions, missing-HWID handling, and resend behavior.
- MIXIN9 tests cover HWID inclusion and visible status messages for every proof/license state.
- UI contract or component tests cover Admin Web actions and Member Order proof states.
- Full TypeScript, Python, and production build verification runs before deployment.

## Acceptance Criteria

- A MIXIN9 proof upload succeeds independently of Telegram delivery and immediately changes buyer-visible status.
- The configured Telegram owner receives a usable proof notification with review actions.
- The invoice appears in the matching member account.
- Approving a paid MIXIN9 order enables one-click license generation and delivery.
- Website checkout still asks for no HWID before payment.
- Telegram and Admin Web show the same products, plans, prices, orders, and resulting licenses.
- `Cek Status` never finishes silently.
