# License Device Reset and Order Safety Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Prevent duplicate MIXIN9 invoices, limit member HWID resets to two per rolling seven days with clear notices, and add useful member order/license filters.

**Architecture:** The AsistenQ service remains authoritative for checkout reuse, active-license blocking, reset quota, and audit history. React renders derived filter groups and reset quota returned by the API, while MIXIN9 adds interface-level guards and migration guidance without replacing server enforcement.

**Tech Stack:** TypeScript, Express, React, Vitest, Python, PyQt5, unittest, PyInstaller.

---

### Task 1: Server-side duplicate checkout protection

**Files:**
- Modify: `tests/services.test.ts`
- Modify: `src/server/services.ts`

- [ ] Add a failing test proving two checkout calls with different idempotency keys but identical product, plan, email, and HWID return the same pending order and a token that authenticates against that order.
- [ ] Run `npm test -- tests/services.test.ts` and confirm a second order is currently created.
- [ ] Change `createLicenseCheckout()` to search reusable pending orders by checkout identity, return a token derived from the stored idempotency key, and reject checkout when an unexpired license already exists for the same product/email/HWID.
- [ ] Add and pass a separate active-license rejection test with the stable Indonesian error message `Lisensi untuk perangkat ini masih aktif.`
- [ ] Run `npm test -- tests/services.test.ts` and confirm both regressions pass.

### Task 2: Reset-event persistence and rolling quota

**Files:**
- Modify: `src/shared/types.ts`
- Modify: `src/server/store.ts`
- Modify: `src/server/services.ts`
- Modify: `tests/license-services.test.ts`

- [ ] Add failing tests for two member resets inside seven days, rejection of the third, recovery after the oldest event leaves the rolling window, unchanged-HWID rejection without quota use, expiration preservation, and an unrestricted but audited admin reset.
- [ ] Run `npm test -- tests/license-services.test.ts` and confirm the missing quota/audit assertions fail.
- [ ] Add `LicenseDeviceResetEvent` with license ID, old/new HWID, actor type/ID, and timestamp; default missing persisted collections to `[]` in store normalization.
- [ ] Extend `resetLicenseDevice()` with actor and time inputs, enforce two successful member events per rolling seven days, retain expiration, regenerate the key, clear activation, and return quota metadata including remaining count and next reset time.
- [ ] Update admin and member reset routes so actor identity is explicit; validate member HWIDs as exactly 16 alphanumeric characters.
- [ ] Run `npm test -- tests/license-services.test.ts` and confirm all reset tests pass.

### Task 3: Member reset quota and notifications

**Files:**
- Modify: `src/server/services.ts`
- Modify: `src/ui/App.tsx`
- Modify: `src/ui/styles.css`
- Modify: `tests/license-services.test.ts`

- [ ] Add a failing dashboard test requiring reset quota metadata for each member license.
- [ ] Return `remaining`, `limit`, and `nextAvailableAt` from `memberLicenseDashboard()`.
- [ ] Render `Sisa reset minggu ini: N dari 2`, a pre-reset warning, success instructions to copy the new token, and a quota-exhausted notice with the next available date/time.
- [ ] Disable reset input/action when quota is exhausted while preserving administrator reset capability.
- [ ] Run the focused service test and `npm run lint`.

### Task 4: Member order and license filters

**Files:**
- Modify: `src/ui/App.tsx`
- Modify: `src/ui/styles.css`
- Create: `src/ui/member-filters.ts`
- Create: `tests/member-filters.test.ts`

- [ ] Write failing pure-function tests mapping paid/approved to `success`, payable/review states to `pending`, cancelled/expired to `cancelled`, and combining status with invoice/product search.
- [ ] Run `npm test -- tests/member-filters.test.ts` and confirm the module is missing.
- [ ] Implement typed order/license grouping and filtering helpers in `member-filters.ts`.
- [ ] Add `Semua`, `Sukses`, `Pending`, and `Dibatalkan` controls with counts, search, result count, and empty state to member orders without changing the four-column desktop card or mobile stacking.
- [ ] Wire license filters to `Semua`, `Aktif`, `Belum Diaktivasi`, and `Kedaluwarsa` through the same normalized helper boundary.
- [ ] Run `npm test -- tests/member-filters.test.ts` and `npm run build`.

### Task 5: MIXIN9 client safeguards

**Files:**
- Modify: `E:/AUTO KLIK/MIXIN9/tests/test_license_client.py`
- Modify: `E:/AUTO KLIK/MIXIN9/tests/test_license_dialog_status.py`
- Modify: `E:/AUTO KLIK/MIXIN9/core/license_client.py`
- Modify: `E:/AUTO KLIK/MIXIN9/gui/license_dialog.py`

- [ ] Add failing tests for stable checkout identity during one pending purchase, active-token button state, in-flight click protection, and device-migration guidance.
- [ ] Run `python -m unittest tests.test_license_client tests.test_license_dialog_status -v` from `E:/AUTO KLIK/MIXIN9` and confirm expected failures.
- [ ] Persist/reuse the current pending checkout identity until terminal status, prevent a second UI request while pending/in flight, and make `render_order()` label and disable the invoice action when a license key is present.
- [ ] Translate mismatched/replaced-device responses into guidance to retrieve the newest token from Area Member.
- [ ] Run the focused Python tests and confirm they pass.

### Task 6: Regression verification and executable build

**Files:**
- Build artifact: `E:/AUTO KLIK/MIXIN9/dist/mixin9.exe`

- [ ] Run `npm test`, `npm run build`, and review output for new failures.
- [ ] Run focused MIXIN9 tests plus the full Python suite, recording unrelated pre-existing failures separately.
- [ ] Build with `python -m PyInstaller --noconfirm --clean mixin9.spec`, ensuring no competing PyInstaller process exists.
- [ ] Check the executable timestamp and size, launch it, and verify the license dialog stays responsive.

### Task 7: Production deployment and safe duplicate cleanup

**Files:**
- Production data only after backup and preview.

- [ ] Commit the verified source changes without staging the user-owned deleted ZIP.
- [ ] Push and deploy the verified commit through the existing cPanel terminal session, then restart exactly one bot/server process as required by the hosting setup.
- [ ] Back up production data and preview pending MIXIN9 orders for the confirmed test email/HWID created after the successful licensed order; list exact invoice numbers.
- [ ] Remove only previewed pending duplicates that have no payment proof and no license link; re-read data and report the removed invoices.
- [ ] Live-test that repeated desktop clicks reuse one pending invoice, an active license cannot create a new invoice, reset quota information appears, and member filters work on desktop and mobile.
