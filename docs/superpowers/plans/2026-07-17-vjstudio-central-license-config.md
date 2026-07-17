# VJ STUDIO Central License Configuration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make AsistenQ the authoritative source for VJ STUDIO plans, prices, badges, vouchers, notices, HWID bans, and license generation while preserving existing licenses and an offline desktop fallback.

**Architecture:** Extend `ProductPlan` with presentation metadata and expose a versioned product configuration endpoint. Add authenticated plan editing to AsistenQ, then isolate desktop network/cache behavior in a small Python client used by `vjstudio.py`. Convert the legacy activation server and CLI into thin AsistenQ clients so no GitHub JSON or embedded credential remains authoritative.

**Tech Stack:** TypeScript, Express, React, Vitest, Python 3 standard library, PyQt6

---

### Task 1: Model VJ STUDIO plan presentation and retirement

**Files:**
- Modify: `src/shared/types.ts`
- Modify: `src/server/seed.ts`
- Modify: `src/server/services.ts`
- Test: `tests/license-services.test.ts`

- [ ] **Step 1: Write a failing public-plan test**

Add a test that expects only `1M`, `3M`, `6M`, and `1Y`, in that order, with `6M` highlighted:

```ts
it('publishes only approved VJ Studio plans in display order', () => {
  const plans = publicPlansForProduct(store, 'vjstudio');
  expect(plans.map((plan) => plan.code)).toEqual(['1M', '3M', '6M', '1Y']);
  expect(plans.find((plan) => plan.code === '6M')).toMatchObject({
    badge: 'Best Seller', highlighted: true, price: 225900
  });
});
```

- [ ] **Step 2: Run the focused test and confirm failure**

Run: `npm test -- tests/license-services.test.ts`

Expected: FAIL because retired plans are still active and badge fields do not exist.

- [ ] **Step 3: Extend `ProductPlan` and seed exact plan state**

Add these optional fields:

```ts
badge?: string;
highlighted?: boolean;
sortOrder?: number;
```

Seed the approved plans with sort orders `10`, `20`, `30`, `40`; set `6M` to `{ badge: 'Best Seller', highlighted: true }`; keep `TRIAL`, `2M`, and `LIFETIME` records but set `isActive: false`.

- [ ] **Step 4: Sort and serialize presentation metadata**

Update `publicPlansForProduct()` to filter active plans, sort by `sortOrder ?? 999`, and return `badge`, `highlighted`, and `sortOrder`.

- [ ] **Step 5: Run the focused tests**

Run: `npm test -- tests/license-services.test.ts`

Expected: PASS.

- [ ] **Step 6: Commit the domain change**

```powershell
git add src/shared/types.ts src/server/seed.ts src/server/services.ts tests/license-services.test.ts
git commit -m "feat: centralize VJ Studio plan catalog"
```

### Task 2: Add versioned public configuration and authenticated plan mutation

**Files:**
- Modify: `src/server/services.ts`
- Modify: `src/server/index.ts`
- Test: `tests/license-services.test.ts`
- Test: `tests/license-domain.test.ts`

- [ ] **Step 1: Write failing service and route tests**

Test the config shape and an admin update that changes price without changing the plan code:

```ts
expect(productLicenseConfig(store, 'vjstudio')).toMatchObject({
  version: 1,
  product: 'vjstudio',
  plans: [{ code: '1M', price: 49900 }]
});

const updated = updateProductPlan(store, plan.id, {
  price: 52900, badge: 'Promo', highlighted: false, sortOrder: 10, isActive: true
});
expect(updated.code).toBe('1M');
expect(updated.price).toBe(52900);
```

Route expectations:

```ts
await request(app).get('/api/license/products/vjstudio/config').expect(200);
await request(app).patch(`/api/admin/plans/${plan.id}`).send({ price: 52900 }).expect(401);
```

- [ ] **Step 2: Run focused tests and confirm failure**

Run: `npm test -- tests/license-services.test.ts tests/license-domain.test.ts`

Expected: FAIL because the service and routes do not exist.

- [ ] **Step 3: Implement service boundaries**

Add `productLicenseConfig(store, slug)` returning `{ version: 1, product, updatedAt, plans, announcement, supportUrl }`. Add `updateProductPlan(store, id, patch)` with server validation: integer nonnegative price, positive or null duration, trimmed badge, integer sort order, and at most one highlighted active plan per product.

- [ ] **Step 4: Add routes**

Add:

```ts
app.get('/api/license/products/:slug/config', (req, res) => {
  res.json(productLicenseConfig(store, String(req.params.slug)));
});

app.patch('/api/admin/plans/:id', requireSession, requireAdminScope('products'), (req, res) => {
  res.json(updateProductPlan(store, String(req.params.id), planPatchSchema.parse(req.body)));
});
```

Keep `/api/packages` as a compatibility alias.

- [ ] **Step 5: Run focused tests**

Run: `npm test -- tests/license-services.test.ts tests/license-domain.test.ts`

Expected: PASS.

- [ ] **Step 6: Commit API support**

```powershell
git add src/server/services.ts src/server/index.ts tests/license-services.test.ts tests/license-domain.test.ts
git commit -m "feat: expose managed license configuration"
```

### Task 3: Add plan management to the AsistenQ admin

**Files:**
- Modify: `src/ui/api.ts`
- Modify: `src/ui/App.tsx`
- Modify: `src/ui/styles.css`
- Test: `tests/product-form.test.ts`

- [ ] **Step 1: Write a failing UI source test**

Add assertions for the plan editor controls and API path:

```ts
expect(source).toContain('Simpan Paket');
expect(source).toContain('Best Seller');
expect(apiSource).toContain('/admin/plans/');
```

- [ ] **Step 2: Run the focused UI test and confirm failure**

Run: `npm test -- tests/product-form.test.ts`

Expected: FAIL because existing products cannot edit plans.

- [ ] **Step 3: Add the typed API client**

Add:

```ts
export function updateAdminPlan(token: string, id: string, patch: Partial<ProductPlan>) {
  return apiRequest<ProductPlan>(`/admin/plans/${id}`, { token, method: 'PATCH', body: patch });
}
```

- [ ] **Step 4: Add the plan editor**

In the existing product-management view, render each plan with name, price, duration, badge, order, active, and highlighted inputs. Save one plan at a time, preserve `code` as read-only, refresh the dashboard after success, and show the existing admin notice on failure.

- [ ] **Step 5: Add responsive styles and run the UI test**

Run: `npm test -- tests/product-form.test.ts`

Expected: PASS.

- [ ] **Step 6: Commit the admin UI**

```powershell
git add src/ui/api.ts src/ui/App.tsx src/ui/styles.css tests/product-form.test.ts
git commit -m "feat: manage license plans from admin"
```

### Task 4: Build a focused AsistenQ client for VJ STUDIO

**Files:**
- Create: `E:\FIX TOOLS YT\VJSTUDIO\asistenq_license_client.py`
- Create: `E:\FIX TOOLS YT\VJSTUDIO\test_asistenq_license_client.py`
- Modify: `E:\FIX TOOLS YT\VJSTUDIO\vjstudio.py`

- [ ] **Step 1: Write failing Python client tests**

Use `unittest` and a stub opener to verify: valid online config wins, malformed data preserves cache, and fallback contains exactly four plans.

```python
self.assertEqual([p['id'] for p in client.fallback_config()['plans']], ['1M', '3M', '6M', '1Y'])
self.assertEqual(client.load_config()['plans'][2]['badge'], 'Best Seller')
```

- [ ] **Step 2: Run tests and confirm failure**

Run: `python -m unittest -v test_asistenq_license_client.py`

Expected: FAIL because the module does not exist.

- [ ] **Step 3: Implement the client**

Create `AsistenQLicenseClient` with:

```python
DEFAULT_BASE_URL = "https://asistenq.com/api"
APPROVED_CODES = ("1M", "3M", "6M", "1Y")
```

Implement `fetch_json()`, schema validation, atomic cache writes under `~/.vjstudio/asistenq_config.json`, `load_config()`, voucher validation, activation, verification, and banned-list retrieval. Use HTTPS, explicit timeouts, and never log tokens.

- [ ] **Step 4: Integrate the desktop dialog**

Replace the old IP default and direct `urllib` calls in `vjstudio.py` with the client. Build package buttons from server `badge` and `highlighted` fields, not `pkg['id'] == '6M'`. Retain the current four-plan embedded fallback and existing date-signature validation.

- [ ] **Step 5: Run Python tests and syntax checks**

Run:

```powershell
python -m unittest -v test_asistenq_license_client.py
python -m py_compile asistenq_license_client.py vjstudio.py
```

Expected: tests PASS and both files compile without output.

- [ ] **Step 6: Commit in the VJ STUDIO repository if tracked**

```powershell
git add asistenq_license_client.py test_asistenq_license_client.py vjstudio.py
git commit -m "feat: load licensing config from AsistenQ"
```

If the VJ STUDIO files remain intentionally untracked, preserve them without forcing an unrelated repository-wide add and report that state explicitly.

### Task 5: Remove legacy GitHub authority from helper services

**Files:**
- Modify: `E:\FIX TOOLS YT\VJSTUDIO\activation_server.py`
- Modify: `E:\FIX TOOLS YT\VJSTUDIO\generate_license.py`
- Create: `E:\FIX TOOLS YT\VJSTUDIO\test_license_helpers.py`

- [ ] **Step 1: Revoke the exposed GitHub PAT outside the codebase**

Revoke the credential in GitHub settings before deploying any edited helper. Do not paste the old or replacement token into source, logs, commits, or the plan.

- [ ] **Step 2: Write failing proxy and CLI tests**

Test that the legacy server maps `/packages`, `/announcement`, `/banned`, `/verify_voucher`, and `/activate` to AsistenQ and that the CLI rejects `LIFETIME`, `TRIAL`, and `2M`.

```python
with self.assertRaises(ValueError):
    validate_plan_code('LIFETIME')
self.assertEqual(validate_plan_code('6M'), '6M')
```

- [ ] **Step 3: Run tests and confirm failure**

Run: `python -m unittest -v test_license_helpers.py`

Expected: FAIL because helpers still use GitHub/local generation.

- [ ] **Step 4: Convert `activation_server.py` into a narrow proxy**

Remove GitHub token, repository name, database synchronization, and local writes. Forward only the compatibility endpoints to `https://asistenq.com/api`, enforce timeouts, preserve response status/content type, and return `502` JSON when upstream is unavailable.

- [ ] **Step 5: Convert `generate_license.py` into an authenticated API CLI**

Read `ASISTENQ_ADMIN_TOKEN` and `ASISTENQ_API_BASE` from environment, validate plan code against `1M`, `3M`, `6M`, `1Y`, and POST `{ productSlug: 'vjstudio', planCode, email, hwid }` to `/api/license/generate`. Remove `SECRET_SALT` and local hashing.

- [ ] **Step 6: Run helper tests and security scan**

Run:

```powershell
python -m unittest -v test_license_helpers.py
python -m py_compile activation_server.py generate_license.py
rg -n "ghp_|github_pat_|SECRET_SALT" activation_server.py generate_license.py asistenq_license_client.py
```

Expected: tests PASS, compilation succeeds, and `rg` returns no matches.

### Task 6: Verify and deploy phase 1

**Files:**
- Modify: `docs/superpowers/plans/2026-07-17-vjstudio-central-license-config.md` (checkboxes only)

- [ ] **Step 1: Run targeted AsistenQ verification**

Run:

```powershell
npm test -- tests/license-services.test.ts tests/license-domain.test.ts tests/product-form.test.ts
npm run lint
npm run build
```

Expected: all targeted tests pass; TypeScript and production build succeed.

- [ ] **Step 2: Run targeted VJ STUDIO verification**

Run:

```powershell
python -m unittest -v test_asistenq_license_client.py test_license_helpers.py
python -m py_compile asistenq_license_client.py activation_server.py generate_license.py vjstudio.py
```

Expected: all tests pass and compilation succeeds.

- [ ] **Step 3: Back up live data and deploy AsistenQ first**

Back up `data/asistenq.json`, deploy the server/admin build, and restart the cPanel Node application. Do not deploy the desktop change before the new config endpoint returns successfully.

- [ ] **Step 4: Verify the live config contract**

Run:

```powershell
(Invoke-WebRequest 'https://asistenq.com/api/license/products/vjstudio/config' -UseBasicParsing).Content
```

Expected: only `1M`, `3M`, `6M`, and `1Y`; `6M` has `Best Seller`; no `TRIAL`, `2M`, or `LIFETIME`.

- [ ] **Step 5: Build a controlled VJ STUDIO test release**

Open the license dialog online and offline. Confirm an admin price edit appears online without rebuilding and the last valid/fallback four-plan list appears offline.

- [ ] **Step 6: Commit deployment notes**

Record the deployed commit, backup path, live endpoint result, and VJ test-build result in the task handoff without storing secrets.

