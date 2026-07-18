# Member Order Four-Column Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fill the member order card with a responsive four-column information hierarchy.

**Architecture:** Split the existing main block into invoice and product-detail blocks, keep payment and actions separate, and use CSS Grid for desktop/tablet/mobile arrangements. The post-payment HWID form remains a full-width grid child.

**Tech Stack:** React, TypeScript, CSS Grid, Vitest source contracts, Vite.

---

### Task 1: Four semantic order columns

**Files:**
- Modify: `src/ui/App.tsx:3359-3374`
- Test: `tests/member-order-layout.test.ts`

- [ ] Write a failing source-contract test requiring `order-history-invoice`, `order-history-detail`, `order-history-total`, and `order-history-actions`.
- [ ] Run `npx vitest run tests/member-order-layout.test.ts` and confirm it fails because the first two blocks do not exist.
- [ ] Split status/invoice from product/date while preserving existing values and actions.
- [ ] Run the focused test and confirm it passes.

### Task 2: Responsive grid

**Files:**
- Modify: `src/ui/styles.css:2691-2759, 3678-3689, 5349-5360`
- Test: `tests/member-order-layout.test.ts`

- [ ] Extend the failing test to require `grid-template-columns: minmax(180px,1.05fr) minmax(220px,1.35fr) minmax(150px,.8fr) auto`, a two-column tablet breakpoint, and a single-column mobile breakpoint.
- [ ] Remove the duplicate three-column override and implement the four-column grid.
- [ ] Make `.member-reset-box` span `grid-column: 1 / -1`.
- [ ] Run the focused test, full `npm test`, `npm run build`, and `git diff --check` for source/test files.

### Task 3: Deploy and visual verification

**Files:**
- Update generated `dist/` and deploy tracked build assets.

- [ ] Commit the tested change, merge it into `master`, and push.
- [ ] Pull and restart the AsistenQ Node app from the active cPanel terminal.
- [ ] Open member Pesanan live and verify four filled desktop columns.
- [ ] Resize the live viewport to tablet and mobile widths and confirm 2x2 then one-column layouts without horizontal overflow.
