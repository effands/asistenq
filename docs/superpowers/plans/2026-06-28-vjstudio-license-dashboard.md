# VJ Studio License Dashboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make AsistenQ's admin and member areas manage real VJ Studio licenses instead of placeholder product lists.

**Architecture:** Keep license generation in the existing TypeScript backend so it stays compatible with the legacy Python formula. Add read models for admin and member dashboards, then wire the React UI to those endpoints with a compact license-control layout. Avoid moving Telegram bot secrets into source; Telegram integration remains a later environment-based step.

**Tech Stack:** React, TypeScript, Express, Vitest, JSON file store, Vite.

---

### Task 1: Backend License Read Models

**Files:**
- Modify: `src/server/services.ts`
- Modify: `src/server/index.ts`
- Modify: `src/ui/api.ts`
- Test: `tests/license-services.test.ts`

- [x] Add tests for member-visible licenses by email and admin license overview.
- [x] Implement `adminLicenseDashboard()` and `memberLicenseDashboard()`.
- [x] Expose `GET /api/admin/licenses` and enrich `GET /api/member/licenses`.

### Task 2: License Operations

**Files:**
- Modify: `src/server/services.ts`
- Test: `tests/license-services.test.ts`

- [x] Add tests for reset device banning old HWID and regenerating a key for the new HWID.
- [x] Update reset behavior to match legacy VJ Studio flow.
- [x] Keep license key format compatible with `generate_license.py`.

### Task 3: Admin License UI

**Files:**
- Modify: `src/ui/App.tsx`
- Modify: `src/ui/styles.css`

- [x] Add real `Lisensi` admin section.
- [x] Add generate license form: product, plan, email, HWID.
- [x] Add license table with status, active device, expiry, copy token, ban/unban and reset UI.

### Task 4: Member License UI

**Files:**
- Modify: `src/ui/App.tsx`
- Modify: `src/ui/styles.css`

- [x] Replace placeholder member screen with account dashboard.
- [x] Add product purchase cards with QRIS payload feedback.
- [x] Show owned/generated licenses by account email, including license key, HWID, expiry, activation status, and VJ Studio activation instructions.

### Task 5: Verify, Commit, Push, Deploy

**Files:**
- No code files beyond Tasks 1-4.

- [x] Run targeted tests.
- [x] Run full tests and production build.
- [ ] Commit and push to GitHub.
- [ ] Pull/build/restart on hosting, then verify live pages.
