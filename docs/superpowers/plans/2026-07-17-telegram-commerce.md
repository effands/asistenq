# Telegram Commerce Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Membuat satu bot Telegram AsistenQ yang aman untuk owner dan pembeli, mendukung katalog, registrasi, checkout QRIS dinamis, bukti bayar, verifikasi manual, lisensi berbasis HWID, download digital, serta pengelolaan produk dan harga.

**Architecture:** Backend TypeScript tetap menjadi sumber data dan aturan bisnis tunggal. Modul `telegram-commerce.ts` menangani identitas, kepemilikan, checkout, bukti bayar, dan pemenuhan; Express hanya memvalidasi request dan menerjemahkannya ke service. Bot Python menyimpan state percakapan sementara dan merender API menjadi inline keyboard, tanpa menghitung harga atau hak akses sendiri.

**Tech Stack:** TypeScript, Express, Zod, JSON file store, Vitest, Python 3 `unittest`, Telegram Bot HTTP API, QRCode.

---

## Peta File

- Create `src/server/telegram-commerce.ts`: aturan bisnis Telegram, identitas pembeli, katalog, checkout, bukti bayar, dan kepemilikan.
- Create `src/server/digital-downloads.ts`: penerbitan dan konsumsi token download.
- Modify `src/shared/types.ts`: tipe pemenuhan, metadata pembayaran, relasi order-plan, dan hak download.
- Modify `src/server/store.ts`: default serta normalisasi koleksi baru.
- Modify `src/server/services.ts`: checkout berbasis paket dan lisensi idempoten per order.
- Modify `src/server/index.ts`: endpoint bot pembeli, endpoint owner, dan endpoint download.
- Create `src/ui/product-form.ts`: pemetaan form admin untuk jenis pemenuhan dan sumber download.
- Modify `src/ui/App.tsx`: kontrol produk lisensi/download pada editor produk admin.
- Modify `integrations/python/telegram_license_bot.py`: role menu, wizard pembeli, bukti bayar, HWID, download, dan wizard produk owner.
- Modify `tests/test_telegram_bot.py`: unit test routing dan state bot.
- Create `tests/telegram-commerce.test.ts`: unit test service transaksi Telegram.
- Create `tests/digital-downloads.test.ts`: unit test token download.
- Modify `tests/services.test.ts`: regresi checkout paket dan lisensi idempoten.

## Task 1: Model Data Telegram Commerce

**Files:**
- Modify: `src/shared/types.ts`
- Modify: `src/server/store.ts`
- Test: `tests/telegram-commerce.test.ts`

- [ ] **Step 1: Write the failing normalization test**

```ts
import { describe, expect, it } from 'vitest';
import { createMemoryStore } from '../src/server/store';

describe('telegram commerce storage', () => {
  it('normalizes download grants for existing databases', () => {
    const store = createMemoryStore({ products: [], orders: [] });
    expect(store.data.downloadGrants).toEqual([]);
  });
});
```

- [ ] **Step 2: Run the test and verify the type or assertion failure**

Run: `npx vitest run tests/telegram-commerce.test.ts`

Expected: FAIL because `downloadGrants` is not part of `DatabaseShape`.

- [ ] **Step 3: Add the commerce types**

```ts
export type ProductFulfillmentType = 'license' | 'download';
export type PaymentProofStatus = 'none' | 'submitted' | 'approved' | 'rejected';

// Insert these exact fields in Product.
fulfillmentType?: ProductFulfillmentType;
downloadSourceUrl?: string;

// Insert these exact fields in Order.
planId?: string;
telegramId?: string;
paymentProofFileId?: string;
paymentProofStatus?: PaymentProofStatus;
paymentProofSubmittedAt?: string;
paymentProofReviewedAt?: string;
paymentProofRejectionReason?: string;
paymentProofReviewerTelegramId?: string;

// Insert this exact field in ToolLicense.
orderId?: string;

export interface DownloadGrant {
  id: string;
  orderId: string;
  memberId: string;
  productId: string;
  tokenHash: string;
  expiresAt: string;
  maxDownloads: number;
  downloadCount: number;
  createdAt: string;
}

// Insert this exact collection in DatabaseShape.
downloadGrants: DownloadGrant[];
```

- [ ] **Step 4: Normalize the new collection**

```ts
const emptyData = (): DatabaseShape => ({
  downloadGrants: []
});

function normalizeData(data: Partial<DatabaseShape>): DatabaseShape {
  return {
    ...emptyData(),
    ...data,
    downloadGrants: data.downloadGrants ?? []
  };
}
```

- [ ] **Step 5: Run the focused and full tests**

Run: `npx vitest run tests/telegram-commerce.test.ts && npm test`

Expected: the focused test and existing 64 tests PASS.

- [ ] **Step 6: Commit**

```bash
git add src/shared/types.ts src/server/store.ts tests/telegram-commerce.test.ts
git commit -m "feat: add Telegram commerce data model"
```

## Task 2: Buyer Identity, Catalog, and Plan Checkout

**Files:**
- Create: `src/server/telegram-commerce.ts`
- Modify: `src/server/services.ts`
- Modify: `tests/telegram-commerce.test.ts`
- Modify: `tests/services.test.ts`

- [ ] **Step 1: Write failing tests for member linking and ownership**

```ts
import { registerTelegramBuyer } from '../src/server/telegram-commerce';

it('creates and then reuses a buyer by Telegram ID', async () => {
  const store = createMemoryStore();
  const first = await registerTelegramBuyer(store, {
    telegramId: '1001', name: 'Budi', email: 'budi@example.com', whatsapp: '08123456789'
  });
  const second = await registerTelegramBuyer(store, {
    telegramId: '1001', name: 'Budi', email: 'budi@example.com', whatsapp: '08123456789'
  });
  expect(second.id).toBe(first.id);
  expect(store.data.members).toHaveLength(1);
});

it('rejects an email linked to another Telegram account', async () => {
  const store = createMemoryStore();
  await registerTelegramBuyer(store, {
    telegramId: '1001', name: 'Budi', email: 'same@example.com', whatsapp: '0812'
  });
  await expect(registerTelegramBuyer(store, {
    telegramId: '2002', name: 'Sari', email: 'same@example.com', whatsapp: '0813'
  })).rejects.toThrow('email sudah terhubung ke akun Telegram lain');
});
```

- [ ] **Step 2: Run and verify RED**

Run: `npx vitest run tests/telegram-commerce.test.ts`

Expected: FAIL because `telegram-commerce.ts` and `registerTelegramBuyer` do not exist.

- [ ] **Step 3: Implement buyer registration**

```ts
import crypto from 'node:crypto';
import { createMember } from './services';
import { formatCurrency } from '../shared/domain';
import type { MemberAccount, Product, ProductPlan } from '../shared/types';
import type { Store } from './store';

export async function registerTelegramBuyer(store: Store, input: {
  telegramId: string;
  name: string;
  email: string;
  whatsapp: string;
}): Promise<MemberAccount> {
  const telegramId = input.telegramId.trim();
  const email = input.email.trim().toLowerCase();
  const byTelegram = store.data.members.find((item) => item.telegramId === telegramId);
  if (byTelegram) return byTelegram;
  const byEmail = store.data.members.find((item) => item.email === email);
  if (byEmail?.telegramId && byEmail.telegramId !== telegramId) {
    throw new Error('email sudah terhubung ke akun Telegram lain');
  }
  if (byEmail) {
    byEmail.telegramId = telegramId;
    byEmail.name = input.name.trim();
    byEmail.whatsapp = input.whatsapp.trim();
    store.save();
    return byEmail;
  }
  return createMember(store, {
    ...input,
    telegramId,
    password: crypto.randomBytes(24).toString('base64url')
  });
}

export function listTelegramCatalog(store: Store) {
  return store.data.products
    .filter((product) => product.active && product.visibility !== 'draft')
    .map((product) => {
      const { downloadSourceUrl: _privateSource, ...publicProduct } = product;
      return {
        ...publicProduct,
        plans: store.data.plans
          .filter((plan) => plan.productId === product.id && plan.isActive)
          .map((plan) => ({ ...plan, formattedPrice: formatCurrency(plan.price) }))
      };
    })
    .filter((product) => product.plans.length > 0);
}
```

- [ ] **Step 4: Write the failing 30-minute plan checkout test**

```ts
it('creates one 30-minute checkout for the same buyer product and plan', async () => {
  const store = createCommerceFixture();
  const now = new Date('2026-07-17T08:00:00.000Z');
  const first = await createTelegramCheckout(store, {
    telegramId: '1001', productId: 'product_1', planId: 'plan_3m'
  }, now);
  const second = await createTelegramCheckout(store, {
    telegramId: '1001', productId: 'product_1', planId: 'plan_3m'
  }, now);
  expect(second.id).toBe(first.id);
  expect(first.expiresAt).toBe('2026-07-17T08:30:00.000Z');
  expect(first.amount).toBe(249000);
  expect(first.uniqueCode).toBeGreaterThanOrEqual(100);
  expect(first.uniqueCode).toBeLessThanOrEqual(999);
});
```

- [ ] **Step 5: Run and verify RED**

Run: `npx vitest run tests/telegram-commerce.test.ts`

Expected: FAIL because `createTelegramCheckout` is missing.

- [ ] **Step 6: Implement plan-based checkout**

```ts
export const telegramInvoiceLifetimeMinutes = 30;

export async function createTelegramCheckout(store: Store, input: {
  telegramId: string;
  productId: string;
  planId: string;
}, now = new Date()): Promise<Order> {
  expirePendingOrders(store, now);
  const member = store.data.members.find((item) => item.telegramId === input.telegramId);
  if (!member) throw new Error('profil pembeli belum lengkap');
  const product = store.data.products.find((item) => item.id === input.productId && item.active);
  const plan = store.data.plans.find((item) => (
    item.id === input.planId && item.productId === input.productId && item.isActive
  ));
  if (!product || !plan) throw new Error('produk atau paket tidak tersedia');
  const reusable = store.data.orders.find((order) => (
    order.memberId === member.id && order.productId === product.id &&
    order.planId === plan.id && order.status === 'pending' &&
    Boolean(order.expiresAt && new Date(order.expiresAt) > now)
  ));
  if (reusable) return reusable;
  return createCheckout(store, member.id, product.id, now, {
    planId: plan.id,
    price: plan.price,
    telegramId: input.telegramId,
    lifetimeMinutes: telegramInvoiceLifetimeMinutes
  });
}
```

Change `createCheckout` to accept the optional final argument shown above, snapshot `planId`, use `price`, and compute expiry from `lifetimeMinutes`; retain existing 24-hour behavior when options are omitted.

```ts
export async function createCheckout(
  store: Store,
  memberId: string,
  productId: string,
  now = new Date(),
  options: { planId?: string; price?: number; telegramId?: string; lifetimeMinutes?: number } = {}
): Promise<Order> {
  const amount = options.price ?? product.price;
  const uniqueCode = amount > 0 ? Math.floor(Math.random() * 900) + 100 : 0;
  const totalAmount = amount + uniqueCode;
  const lifetimeMs = options.lifetimeMinutes === undefined
    ? invoiceLifetimeHours * 60 * 60 * 1000
    : options.lifetimeMinutes * 60 * 1000;
  const expiresAt = new Date(now.getTime() + lifetimeMs).toISOString();
  const generatedQris = amount > 0
    ? await generateDynamicQris(store.data.deploymentSettings?.qrisStaticPayload ?? '', totalAmount)
    : undefined;
  const order: Order = {
    id: createId('order'), memberId, productId,
    invoiceNumber: `INV-${now.toISOString().slice(0, 10).replace(/-/g, '')}-${String(store.data.orders.length + 1).padStart(4, '0')}`,
    productName: product.name,
    planId: options.planId,
    telegramId: options.telegramId,
    uniqueCode, amount, totalAmount,
    status: 'pending',
    qrisPayload: generatedQris?.payload ?? '',
    paymentQrUrl: generatedQris?.dataUrl,
    paymentProofStatus: 'none',
    createdAt: now.toISOString(),
    expiresAt
  };
  store.data.orders.push(order);
  store.save();
  return order;
}
```

- [ ] **Step 7: Run focused tests and full suite**

Run: `npx vitest run tests/telegram-commerce.test.ts tests/services.test.ts && npm test`

Expected: all tests PASS.

- [ ] **Step 8: Commit**

```bash
git add src/server/telegram-commerce.ts src/server/services.ts tests/telegram-commerce.test.ts tests/services.test.ts
git commit -m "feat: create Telegram buyer checkouts"
```

## Task 3: Buyer and Owner API Boundaries

**Files:**
- Modify: `src/server/index.ts`
- Create: `tests/telegram-commerce-routes.test.ts`

- [ ] **Step 1: Install the HTTP test dependency**

Run: `npm install --save-dev supertest @types/supertest`

Expected: `package.json` and `package-lock.json` contain `supertest` and its TypeScript types.

- [ ] **Step 2: Write route authorization tests**

Create an Express test harness exporting `app` without listening during tests, then assert:

```ts
it('rejects an owner route for a non-owner Telegram ID', async () => {
  const response = await request(app)
    .get('/api/bot/owner/payment-proofs')
    .set('x-asistenq-bot-secret', botSecret)
    .set('x-telegram-user-id', 'buyer-1');
  expect(response.status).toBe(403);
});

it('returns only orders owned by the buyer Telegram ID', async () => {
  const response = await request(app)
    .get('/api/bot/buyer/orders')
    .set('x-asistenq-bot-secret', botSecret)
    .set('x-telegram-user-id', 'buyer-1');
  expect(response.status).toBe(200);
  expect(response.body.orders.map((order: { invoiceNumber: string }) => order.invoiceNumber)).toEqual(['INV-BUYER-1']);
});
```

- [ ] **Step 3: Run and verify RED**

Run: `npx vitest run tests/telegram-commerce-routes.test.ts`

Expected: FAIL because the owner/buyer routes and Telegram identity middleware are missing.

- [ ] **Step 4: Add identity and owner middleware**

```ts
function telegramUserId(req: express.Request): string {
  return String(req.header('x-telegram-user-id') ?? '').trim();
}

function requireTelegramIdentity(req: express.Request, res: express.Response, next: express.NextFunction) {
  if (!telegramUserId(req)) {
    res.status(400).json({ message: 'Telegram ID wajib diisi' });
    return;
  }
  next();
}

function requireBotOwner(req: express.Request, res: express.Response, next: express.NextFunction) {
  const ownerId = store.data.deploymentSettings?.telegramOwnerId ?? process.env.TELEGRAM_OWNER_ID ?? '';
  if (!ownerId || telegramUserId(req) !== ownerId) {
    res.status(403).json({ message: 'owner access required' });
    return;
  }
  next();
}
```

- [ ] **Step 5: Add buyer routes**

```ts
app.post('/api/bot/buyer/register', requireBotSecret, requireTelegramIdentity, async (req, res) => {
  const body = telegramBuyerSchema.parse({ ...req.body, telegramId: telegramUserId(req) });
  res.json(await registerTelegramBuyer(store, body));
});

app.get('/api/bot/buyer/products', requireBotSecret, requireTelegramIdentity, (_req, res) => {
  res.json({ products: listTelegramCatalog(store) });
});

app.post('/api/bot/buyer/checkout', requireBotSecret, requireTelegramIdentity, async (req, res) => {
  const body = telegramCheckoutSchema.parse(req.body);
  const order = await createTelegramCheckout(store, {
    ...body, telegramId: telegramUserId(req)
  });
  res.status(201).json(publicOrder(order));
});

app.get('/api/bot/buyer/orders', requireBotSecret, requireTelegramIdentity, (req, res) => {
  const member = store.data.members.find((item) => item.telegramId === telegramUserId(req));
  const orders = member ? store.data.orders.filter((item) => item.memberId === member.id) : [];
  res.json({ orders: orders.map(publicOrder) });
});
```

- [ ] **Step 6: Protect all existing admin bot routes**

Add `requireTelegramIdentity, requireBotOwner` after `requireBotSecret` on admin summary, pending orders, paid/review operations, license generation, HWID operations, product management, and deployment update.

- [ ] **Step 7: Run route tests and full suite**

Run: `npx vitest run tests/telegram-commerce-routes.test.ts && npm test`

Expected: route tests and full suite PASS.

- [ ] **Step 8: Commit**

```bash
git add package.json package-lock.json src/server/index.ts tests/telegram-commerce-routes.test.ts
git commit -m "feat: expose role-safe Telegram commerce API"
```

## Task 4: Role-Based Bot Menu and Buyer Registration Wizard

**Files:**
- Modify: `integrations/python/telegram_license_bot.py`
- Modify: `tests/test_telegram_bot.py`

- [ ] **Step 1: Write failing menu tests**

```py
def test_owner_gets_admin_menu(self):
    labels = [button['text'] for row in BOT.menu_for('87394692')['inline_keyboard'] for button in row]
    self.assertIn('➕ Tambah Produk', labels)
    self.assertNotIn('🛍️ Lihat Produk', labels)

def test_buyer_gets_store_menu(self):
    labels = [button['text'] for row in BOT.menu_for('2002')['inline_keyboard'] for button in row]
    self.assertIn('🛍️ Lihat Produk', labels)
    self.assertNotIn('🚀 Update Website', labels)
```

- [ ] **Step 2: Run and verify RED**

Run: `python -m unittest tests.test_telegram_bot -v`

Expected: FAIL because `menu_for` does not exist.

- [ ] **Step 3: Implement role menus and identity headers**

```py
def is_owner(chat_id: int) -> bool:
    return str(chat_id) == OWNER_ID

def menu_for(chat_id: str) -> Dict[str, Any]:
    return main_menu() if chat_id == OWNER_ID else buyer_menu()

def buyer_menu() -> Dict[str, Any]:
    return keyboard([
        [{"text": "🛍️ Lihat Produk", "callback_data": "shop"}],
        [{"text": "🧾 Transaksi Saya", "callback_data": "my_orders"},
         {"text": "💳 Bayar Invoice", "callback_data": "pay_invoice"}],
        [{"text": "📤 Kirim Bukti Bayar", "callback_data": "proof_menu"}],
        [{"text": "🔑 Lisensi Saya", "callback_data": "my_licenses"},
         {"text": "📥 Download Saya", "callback_data": "my_downloads"}],
        [{"text": "🆘 Bantuan", "callback_data": "buyer_help"}],
    ])

def api(path: str, method: str = "GET", body=None, timeout=HTTP_TIMEOUT_SECONDS,
        telegram_id: str = OWNER_ID) -> Any:
    return request_json(f"{API_BASE}{path}", method, body, {
        "x-asistenq-bot-secret": BOT_SECRET,
        "x-telegram-user-id": telegram_id,
    }, timeout=timeout)
```

- [ ] **Step 4: Write failing registration state tests**

```py
def test_registration_wizard_collects_name_email_and_whatsapp(self):
    state = {"action": "buyer_register", "step": "name", "values": {}}
    state = BOT.advance_registration(state, "Budi")
    state = BOT.advance_registration(state, "budi@example.com")
    state = BOT.advance_registration(state, "08123456789")
    self.assertEqual(state["step"], "complete")
    self.assertEqual(state["values"]["email"], "budi@example.com")
```

- [ ] **Step 5: Implement and integrate registration state**

```py
def advance_registration(state: Dict[str, Any], text: str) -> Dict[str, Any]:
    value = text.strip()
    if state["step"] == "name":
        if len(value) < 2: raise ValueError("Nama minimal 2 karakter.")
        return {**state, "step": "email", "values": {**state["values"], "name": value}}
    if state["step"] == "email":
        if "@" not in value: raise ValueError("Email tidak valid.")
        return {**state, "step": "whatsapp", "values": {**state["values"], "email": value.lower()}}
    digits = "".join(char for char in value if char.isdigit())
    if len(digits) < 9: raise ValueError("Nomor WhatsApp tidak valid.")
    return {**state, "step": "complete", "values": {**state["values"], "whatsapp": digits}}
```

When complete, POST the values to `/bot/buyer/register`, clear pending state, and reopen the pending catalog or checkout action.

- [ ] **Step 6: Run Python and full tests**

Run: `python -m unittest tests.test_telegram_bot -v && npm test`

Expected: all tests PASS.

- [ ] **Step 7: Commit**

```bash
git add integrations/python/telegram_license_bot.py tests/test_telegram_bot.py
git commit -m "feat: add Telegram buyer menu and registration"
```

## Task 5: Catalog Buttons, QRIS Rendering, and My Orders

**Files:**
- Modify: `integrations/python/telegram_license_bot.py`
- Modify: `tests/test_telegram_bot.py`

- [ ] **Step 1: Write failing rendering tests**

```py
def test_catalog_buttons_carry_product_and_plan_ids(self):
    products = [{"id": "p1", "name": "VJ Studio", "plans": [
        {"id": "plan3", "name": "3 Bulan", "formattedPrice": "Rp249.000"}
    ]}]
    markup = BOT.catalog_keyboard(products)
    self.assertEqual(markup["inline_keyboard"][0][0]["callback_data"], "buy:p1:plan3")

def test_checkout_caption_contains_invoice_total_and_expiry(self):
    caption = BOT.checkout_caption({
        "invoiceNumber": "INV-1", "productName": "VJ Studio",
        "formattedAmount": "Rp249.000", "uniqueCode": 321,
        "formattedTotalAmount": "Rp249.321", "expiresAt": "2026-07-17T08:30:00.000Z"
    })
    self.assertIn("INV-1", caption)
    self.assertIn("Rp249.321", caption)
    self.assertIn("321", caption)

def test_qris_data_url_decodes_to_png(self):
    self.assertEqual(BOT.decode_qris_data_url("data:image/png;base64,aGVsbG8="), b"hello")
```

- [ ] **Step 2: Run and verify RED**

Run: `python -m unittest tests.test_telegram_bot -v`

Expected: FAIL because rendering helpers do not exist.

- [ ] **Step 3: Implement catalog, checkout, and QRIS sending**

```py
def catalog_keyboard(products: List[Dict[str, Any]]) -> Dict[str, Any]:
    rows = []
    for product in products:
        for plan in product.get("plans", []):
            rows.append([{
                "text": f"🛒 {product['name']} • {plan['name']} • {plan['formattedPrice']}",
                "callback_data": f"buy:{product['id']}:{plan['id']}"
            }])
    rows.append([{"text": "🏠 Menu", "callback_data": "menu"}])
    return keyboard(rows)

def send_photo(chat_id: int, photo: str, caption: str, reply_markup=None) -> None:
    body = {"chat_id": chat_id, "photo": photo, "caption": caption}
    if reply_markup: body["reply_markup"] = reply_markup
    telegram("sendPhoto", body)

def decode_qris_data_url(data_url: str) -> bytes:
    import base64
    prefix = "data:image/png;base64,"
    if not data_url.startswith(prefix):
        raise ValueError("Format gambar QRIS tidak valid.")
    return base64.b64decode(data_url[len(prefix):], validate=True)

def send_photo_bytes(chat_id: int, photo: bytes, caption: str, reply_markup=None) -> None:
    boundary = "----AsistenQTelegramBoundary"
    fields = {"chat_id": str(chat_id), "caption": caption}
    if reply_markup:
        fields["reply_markup"] = json.dumps(reply_markup)
    chunks = []
    for name, value in fields.items():
        chunks.append(f"--{boundary}\r\nContent-Disposition: form-data; name=\"{name}\"\r\n\r\n{value}\r\n".encode())
    chunks.append(
        f"--{boundary}\r\nContent-Disposition: form-data; name=\"photo\"; filename=\"qris.png\"\r\n"
        "Content-Type: image/png\r\n\r\n".encode() + photo + b"\r\n"
    )
    chunks.append(f"--{boundary}--\r\n".encode())
    request = urllib.request.Request(
        f"https://api.telegram.org/bot{BOT_TOKEN}/sendPhoto",
        data=b"".join(chunks),
        headers={"Content-Type": f"multipart/form-data; boundary={boundary}"},
        method="POST"
    )
    with urllib.request.urlopen(request, timeout=HTTP_TIMEOUT_SECONDS) as response:
        parse_json_response(response.read().decode("utf-8"), request.full_url)

def checkout_caption(order: Dict[str, Any]) -> str:
    return (
        f"Invoice {order['invoiceNumber']}\n{order['productName']}\n"
        f"Harga: {order['formattedAmount']}\nKode unik: {order['uniqueCode']}\n"
        f"Total: {order['formattedTotalAmount']}\nBerlaku sampai: {order['expiresAt']}"
    )
```

Handle `shop`, `buy:<product>:<plan>`, and `my_orders`. For checkout, decode `paymentQrUrl` with `decode_qris_data_url` and upload the bytes with `send_photo_bytes`.

- [ ] **Step 4: Run Python tests**

Run: `python -m unittest tests.test_telegram_bot -v`

Expected: all tests PASS.

- [ ] **Step 5: Commit**

```bash
git add integrations/python/telegram_license_bot.py tests/test_telegram_bot.py
git commit -m "feat: render Telegram catalog and QRIS checkout"
```

## Task 6: Payment Proof Submission and Owner Review

**Files:**
- Modify: `src/server/telegram-commerce.ts`
- Modify: `src/server/index.ts`
- Create: `src/ui/product-form.ts`
- Modify: `src/ui/App.tsx`
- Modify: `integrations/python/telegram_license_bot.py`
- Modify: `tests/telegram-commerce.test.ts`
- Create: `tests/product-form.test.ts`
- Modify: `tests/test_telegram_bot.py`

- [ ] **Step 1: Write failing service tests**

```ts
it('accepts proof only from the order owner and reviews it idempotently', () => {
  const store = createPaidFlowFixture();
  const submitted = submitPaymentProof(store, {
    telegramId: 'buyer-1', invoiceNumber: 'INV-1', fileId: 'telegram-file-1'
  }, new Date('2026-07-17T08:10:00Z'));
  expect(submitted.paymentProofStatus).toBe('submitted');
  expect(() => submitPaymentProof(store, {
    telegramId: 'buyer-2', invoiceNumber: 'INV-1', fileId: 'stolen'
  })).toThrow('order tidak ditemukan');
  const first = reviewPaymentProof(store, {
    ownerTelegramId: 'owner', invoiceNumber: 'INV-1', decision: 'approve'
  });
  const second = reviewPaymentProof(store, {
    ownerTelegramId: 'owner', invoiceNumber: 'INV-1', decision: 'approve'
  });
  expect(second.order.id).toBe(first.order.id);
  expect(second.order.status).toBe('paid');
});

it('requires the owner to reopen an expired invoice before review', () => {
  const store = createExpiredProofFixture();
  expect(() => reviewPaymentProof(store, {
    ownerTelegramId: 'owner', invoiceNumber: 'INV-EXPIRED', decision: 'approve'
  })).toThrow('invoice harus dibuka kembali');
  const reopened = reopenTelegramInvoice(store, {
    ownerTelegramId: 'owner', invoiceNumber: 'INV-EXPIRED'
  }, new Date('2026-07-17T09:00:00Z'));
  expect(reopened.status).toBe('pending');
  expect(reopened.expiresAt).toBe('2026-07-17T09:30:00.000Z');
});
```

- [ ] **Step 2: Run and verify RED**

Run: `npx vitest run tests/telegram-commerce.test.ts`

Expected: FAIL because proof functions are missing.

- [ ] **Step 3: Implement proof service functions**

```ts
export function submitPaymentProof(store: Store, input: {
  telegramId: string; invoiceNumber: string; fileId: string;
}, now = new Date()): Order {
  const member = store.data.members.find((item) => item.telegramId === input.telegramId);
  const order = member && store.data.orders.find((item) => (
    item.memberId === member.id && item.invoiceNumber === input.invoiceNumber
  ));
  if (!order) throw new Error('order tidak ditemukan');
  if (order.status !== 'pending') throw new Error('invoice tidak dapat menerima bukti');
  if (order.expiresAt && new Date(order.expiresAt) <= now) throw new Error('invoice sudah kedaluwarsa');
  order.paymentProofFileId = input.fileId;
  order.paymentProofStatus = 'submitted';
  order.paymentProofSubmittedAt = now.toISOString();
  order.paymentProofRejectionReason = undefined;
  store.save();
  return order;
}
```

Implement `reviewPaymentProof` with `approve` calling `markOrderPaidByInvoice`, and `reject` requiring a non-empty reason. Repeated identical decisions return the current order without duplicating subscriptions or audit entries.

Implement `reopenTelegramInvoice` for owner-only use. It may change only an `expired` order with submitted proof back to `pending`, sets a new 30-minute expiry, retains the original proof timestamps, and writes an audit entry.

- [ ] **Step 4: Add proof routes**

```ts
app.post('/api/bot/buyer/payment-proof', requireBotSecret, requireTelegramIdentity, (req, res) => {
  const body = paymentProofSchema.parse(req.body);
  res.json(publicOrder(submitPaymentProof(store, {
    ...body, telegramId: telegramUserId(req)
  })));
});

app.get('/api/bot/owner/payment-proofs', requireBotSecret, requireTelegramIdentity, requireBotOwner, (_req, res) => {
  res.json({ orders: listSubmittedPaymentProofs(store).map(publicOrder) });
});

app.post('/api/bot/owner/payment-proofs/:invoice/review', requireBotSecret, requireTelegramIdentity, requireBotOwner, (req, res) => {
  const body = paymentReviewSchema.parse(req.body);
  res.json(reviewPaymentProof(store, {
    ...body, invoiceNumber: String(req.params.invoice), ownerTelegramId: telegramUserId(req)
  }));
});

app.post('/api/bot/owner/orders/:invoice/reopen', requireBotSecret, requireTelegramIdentity, requireBotOwner, (req, res) => {
  res.json(reopenTelegramInvoice(store, {
    invoiceNumber: String(req.params.invoice), ownerTelegramId: telegramUserId(req)
  }));
});
```

- [ ] **Step 5: Add bot photo-state and owner buttons**

When `proof_menu` is selected, list the buyer's pending invoices. Store `await_payment_proof` with invoice number. When a message contains `photo`, use the largest photo's `file_id`, POST it, then call `sendPhoto` to owner with:

```py
keyboard([[{"text": "✅ Verifikasi", "callback_data": f"proof_ok:{invoice}"}],
          [{"text": "❌ Tolak", "callback_data": f"proof_no:{invoice}"}],
          [{"text": "🔍 Detail", "callback_data": f"order:{invoice}"}]])
```

For rejection, store `await_rejection_reason` and POST the next owner message as the reason.

- [ ] **Step 6: Run all focused tests and full suite**

Run: `npx vitest run tests/telegram-commerce.test.ts tests/telegram-commerce-routes.test.ts && python -m unittest tests.test_telegram_bot -v && npm test`

Expected: all tests PASS.

- [ ] **Step 7: Commit**

```bash
git add src/server/telegram-commerce.ts src/server/index.ts integrations/python/telegram_license_bot.py tests/telegram-commerce.test.ts tests/test_telegram_bot.py
git commit -m "feat: review Telegram payment proofs"
```

## Task 7: Paid License Fulfillment After HWID

**Files:**
- Modify: `src/server/services.ts`
- Modify: `src/server/index.ts`
- Modify: `integrations/python/telegram_license_bot.py`
- Modify: `tests/services.test.ts`
- Modify: `tests/test_telegram_bot.py`

- [ ] **Step 1: Write the idempotency test**

```ts
it('returns one license for repeated fulfillment of the same paid order', () => {
  const store = createPaidOrderFixture();
  const first = generateLicenseForPaidOrder(store, {
    invoiceNumber: 'INV-1', hwid: 'ABCDEF1234567890', salt: 'test'
  });
  const second = generateLicenseForPaidOrder(store, {
    invoiceNumber: 'INV-1', hwid: 'ABCDEF1234567890', salt: 'test'
  });
  expect(second.id).toBe(first.id);
  expect(first.orderId).toBe('order_1');
  expect(store.data.licenses).toHaveLength(1);
});
```

- [ ] **Step 2: Run and verify RED**

Run: `npx vitest run tests/services.test.ts`

Expected: FAIL because the current function always creates another license and omits `orderId`.

- [ ] **Step 3: Make fulfillment idempotent and tied to the purchased plan**

Before generating, return an existing license with the same `orderId`. Resolve the plan from `order.planId`; only use the legacy price fallback for old orders. Store `orderId` on the generated license.

```ts
const existing = store.data.licenses.find((item) => item.orderId === order.id);
if (existing) return existing;

const matchingPlan = order.planId
  ? store.data.plans.find((plan) => plan.id === order.planId && plan.productId === product.id)
  : activePlans.find((plan) => plan.price === order.amount) ?? activePlans[0];
```

- [ ] **Step 4: Add buyer fulfillment endpoints**

```ts
app.post('/api/bot/buyer/orders/:invoice/hwid', requireBotSecret, requireTelegramIdentity, (req, res) => {
  const body = hwidOnlySchema.parse(req.body);
  assertTelegramOrderOwner(store, telegramUserId(req), String(req.params.invoice));
  const license = generateLicenseForPaidOrder(store, {
    invoiceNumber: String(req.params.invoice), hwid: body.hwid
  });
  void emailLicense(license, String(req.params.invoice));
  res.status(201).json(license);
});

app.get('/api/bot/buyer/licenses', requireBotSecret, requireTelegramIdentity, (req, res) => {
  res.json({ licenses: listTelegramBuyerLicenses(store, telegramUserId(req)) });
});
```

- [ ] **Step 5: Add the HWID bot state**

After proof approval for a `license` product, send the buyer a `🔑 Masukkan HWID` button. Store `await_paid_hwid` with invoice number, validate exactly 16 alphanumeric characters, POST to the fulfillment endpoint, then send product, plan, HWID, key, and expiry.

- [ ] **Step 6: Run tests and commit**

Run: `npx vitest run tests/services.test.ts tests/telegram-commerce-routes.test.ts && python -m unittest tests.test_telegram_bot -v && npm test`

Expected: all tests PASS.

```bash
git add src/server/services.ts src/server/index.ts integrations/python/telegram_license_bot.py tests/services.test.ts tests/test_telegram_bot.py
git commit -m "feat: fulfill paid Telegram licenses"
```

## Task 8: Secure Digital Download Grants

**Files:**
- Create: `src/server/digital-downloads.ts`
- Modify: `src/server/index.ts`
- Modify: `integrations/python/telegram_license_bot.py`
- Create: `tests/digital-downloads.test.ts`

- [ ] **Step 1: Write failing token tests**

```ts
it('allows three downloads before rejecting the token', () => {
  const store = createPaidDownloadFixture();
  const issued = issueDownloadGrant(store, 'order_download', new Date('2026-07-17T08:00:00Z'), 'raw-token');
  expect(consumeDownloadGrant(store, issued.token, new Date('2026-07-17T09:00:00Z')).grant.downloadCount).toBe(1);
  consumeDownloadGrant(store, issued.token, new Date('2026-07-17T09:01:00Z'));
  consumeDownloadGrant(store, issued.token, new Date('2026-07-17T09:02:00Z'));
  expect(() => consumeDownloadGrant(store, issued.token, new Date('2026-07-17T09:03:00Z')))
    .toThrow('batas download habis');
});

it('rejects an expired download token', () => {
  const store = createPaidDownloadFixture();
  const issued = issueDownloadGrant(store, 'order_download', new Date('2026-07-17T08:00:00Z'), 'raw-token');
  expect(() => consumeDownloadGrant(store, issued.token, new Date('2026-07-18T08:00:01Z')))
    .toThrow('link download kedaluwarsa');
});
```

- [ ] **Step 2: Run and verify RED**

Run: `npx vitest run tests/digital-downloads.test.ts`

Expected: FAIL because the download module does not exist.

- [ ] **Step 3: Implement hashed 24-hour, three-use grants**

```ts
import crypto from 'node:crypto';

const hashToken = (token: string) => crypto.createHash('sha256').update(token).digest('hex');

export function issueDownloadGrant(store: Store, orderId: string, now = new Date(), fixedToken?: string) {
  const order = store.data.orders.find((item) => item.id === orderId && item.status === 'paid');
  if (!order) throw new Error('order paid tidak ditemukan');
  const product = store.data.products.find((item) => item.id === order.productId);
  if (!product || product.fulfillmentType !== 'download' || !product.downloadSourceUrl) {
    throw new Error('file produk digital belum diatur');
  }
  const existing = store.data.downloadGrants.find((item) => item.orderId === order.id && new Date(item.expiresAt) > now);
  if (existing) throw new Error('gunakan penerbitan ulang untuk mengganti token aktif');
  const token = fixedToken ?? crypto.randomBytes(32).toString('base64url');
  const grant = {
    id: crypto.randomUUID(), orderId: order.id, memberId: order.memberId, productId: product.id,
    tokenHash: hashToken(token), expiresAt: new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString(),
    maxDownloads: 3, downloadCount: 0, createdAt: now.toISOString()
  };
  store.data.downloadGrants.push(grant);
  store.save();
  return { grant, token };
}

export function reissueDownloadGrant(store: Store, orderId: string, now = new Date(), fixedToken?: string) {
  for (const grant of store.data.downloadGrants.filter((item) => item.orderId === orderId)) {
    grant.expiresAt = now.toISOString();
  }
  store.save();
  return issueDownloadGrant(store, orderId, now, fixedToken);
}
```

Implement `consumeDownloadGrant` to hash the raw token, validate expiry/count/order/product, increment count atomically before returning `{ grant, sourceUrl }`.

- [ ] **Step 4: Add issue/list/download routes**

Buyer list routes return generated HTTPS links but never `downloadSourceUrl`. The public `GET /api/download/:token` consumes the token and either streams a server-local file with `res.download` or redirects to an allowlisted HTTPS source. Reject `file:`, private-network hosts, and non-HTTPS remote sources.

- [ ] **Step 5: Add bot download rendering**

After payment approval for a download product, issue the grant and send a URL button:

```py
keyboard([[{"text": "📥 Download Sekarang", "url": grant["downloadUrl"]}],
          [{"text": "🏠 Menu", "callback_data": "menu"}]])
```

`my_downloads` lists active grants only and includes expiry plus remaining downloads.

- [ ] **Step 6: Run tests and commit**

Run: `npx vitest run tests/digital-downloads.test.ts tests/telegram-commerce-routes.test.ts && python -m unittest tests.test_telegram_bot -v && npm test`

Expected: all tests PASS.

```bash
git add src/server/digital-downloads.ts src/server/index.ts integrations/python/telegram_license_bot.py tests/digital-downloads.test.ts tests/test_telegram_bot.py
git commit -m "feat: deliver secure Telegram downloads"
```

## Task 9: Owner Product and Price Wizard

**Files:**
- Modify: `src/server/telegram-commerce.ts`
- Modify: `src/server/index.ts`
- Modify: `integrations/python/telegram_license_bot.py`
- Modify: `tests/telegram-commerce.test.ts`
- Modify: `tests/test_telegram_bot.py`

- [ ] **Step 1: Write failing product command tests**

```ts
it('creates a draft product with one active plan and snapshots its fulfillment type', () => {
  const store = createMemoryStore();
  const result = createTelegramProduct(store, {
    name: 'Mixer Pro', slug: 'mixer-pro', fulfillmentType: 'license',
    description: 'Mixer audio', status: 'draft',
    plan: { code: '1M', name: '1 Bulan', price: 59000, durationDays: 30 }
  });
  expect(result.product.visibility).toBe('draft');
  expect(result.product.fulfillmentType).toBe('license');
  expect(result.plan.price).toBe(59000);
});

it('deactivates a product without deleting order history', () => {
  const store = createProductWithOrderFixture();
  deactivateTelegramProduct(store, 'product_1');
  expect(store.data.products[0].active).toBe(false);
  expect(store.data.orders).toHaveLength(1);
});
```

- [ ] **Step 2: Run and verify RED**

Run: `npx vitest run tests/telegram-commerce.test.ts`

Expected: FAIL because product service commands are missing.

- [ ] **Step 3: Implement product commands through existing domain functions**

`createTelegramProduct` must call the existing product creation function and `createProductPlan`; it must not push raw records independently. For download products, validate an HTTPS source URL. `updateTelegramPlanPrice` edits the plan for future checkouts only; existing order `amount` and `totalAmount` remain unchanged. `deactivateTelegramProduct` sets `active=false` and `visibility='draft'`.

- [ ] **Step 4: Add owner product routes**

```ts
app.post('/api/bot/owner/products', requireBotSecret, requireTelegramIdentity, requireBotOwner, (req, res) => {
  res.status(201).json(createTelegramProduct(store, telegramProductSchema.parse(req.body)));
});

app.patch('/api/bot/owner/products/:id', requireBotSecret, requireTelegramIdentity, requireBotOwner, (req, res) => {
  res.json(updateTelegramProduct(store, String(req.params.id), telegramProductPatchSchema.parse(req.body)));
});

app.patch('/api/bot/owner/plans/:id', requireBotSecret, requireTelegramIdentity, requireBotOwner, (req, res) => {
  res.json(updateTelegramPlan(store, String(req.params.id), telegramPlanPatchSchema.parse(req.body)));
});

app.post('/api/bot/owner/products/:id/digital-file', requireBotSecret, requireTelegramIdentity, requireBotOwner,
  digitalProductUpload.single('file'), (req, res) => {
    if (!req.file) return res.status(400).json({ message: 'File ZIP wajib diunggah.' });
    res.json(attachTelegramDigitalFile(store, String(req.params.id), req.file.path));
  });
```

Configure `digitalProductUpload` with Multer disk storage under `data/digital-products`, a 50 MB limit, a randomized server filename, and a file filter that accepts ZIP only. Install `multer` and `@types/multer` in this task. `attachTelegramDigitalFile` verifies `fulfillmentType === 'download'` and stores a private absolute path that is never serialized in public product responses.

- [ ] **Step 5: Write and implement the owner wizard state test**

```py
def test_owner_product_wizard_reaches_confirmation(self):
    state = BOT.new_product_state()
    for value in ["Mixer Pro", "mixer-pro", "license", "Mixer audio", "1M", "1 Bulan", "59000", "30", "draft"]:
        state = BOT.advance_product_wizard(state, value)
    self.assertEqual(state["step"], "confirm")
    self.assertEqual(state["values"]["plan"]["price"], 59000)
```

Implement explicit steps for name, slug, fulfillment type, description, plan code/name/price/duration, optional download source, status, and confirmation. `✅ Simpan Produk` performs one POST; `❌ Batal` clears state without mutation.

For a download product, show `📎 Upload ZIP` and `🔗 Pakai URL HTTPS`. On upload, resolve the largest Telegram document through `getFile`, download it with the bot token, reject files over 50 MB or without a `.zip` name, and POST multipart bytes to `/bot/owner/products/:id/digital-file`. Delete the temporary local bot file after the backend responds.

- [ ] **Step 6: Add a tested admin-web payload mapper**

```ts
// tests/product-form.test.ts
import { expect, it } from 'vitest';
import { buildProductFulfillmentPatch } from '../src/ui/product-form';

it('omits a download source for license products', () => {
  expect(buildProductFulfillmentPatch('license', 'https://files.example.com/tool.zip')).toEqual({
    fulfillmentType: 'license'
  });
});

it('keeps an HTTPS source for download products', () => {
  expect(buildProductFulfillmentPatch('download', 'https://files.example.com/tool.zip')).toEqual({
    fulfillmentType: 'download', downloadSourceUrl: 'https://files.example.com/tool.zip'
  });
});
```

Run: `npx vitest run tests/product-form.test.ts`

Expected: FAIL because `product-form.ts` does not exist.

```ts
// src/ui/product-form.ts
import type { ProductFulfillmentType } from '../shared/types';

export function buildProductFulfillmentPatch(type: ProductFulfillmentType, sourceInput: string) {
  if (type === 'license') return { fulfillmentType: type };
  const downloadSourceUrl = sourceInput.trim();
  if (!downloadSourceUrl.startsWith('https://')) throw new Error('URL download harus HTTPS.');
  return { fulfillmentType: type, downloadSourceUrl };
}
```

In the product editor in `App.tsx`, add a select with values `license` and `download`. Show the HTTPS source input only for `download`, merge `buildProductFulfillmentPatch(...)` into the existing create/update payload, and display the existing uploaded-file state without exposing the private server path.

- [ ] **Step 7: Run tests and commit**

Run: `npm install --save multer && npm install --save-dev @types/multer && npx vitest run tests/telegram-commerce.test.ts tests/telegram-commerce-routes.test.ts tests/product-form.test.ts && python -m unittest tests.test_telegram_bot -v && npm test`

Expected: all tests PASS.

```bash
git add package.json package-lock.json src/server/telegram-commerce.ts src/server/index.ts src/ui/product-form.ts src/ui/App.tsx integrations/python/telegram_license_bot.py tests/telegram-commerce.test.ts tests/product-form.test.ts tests/test_telegram_bot.py
git commit -m "feat: manage products from Telegram"
```

## Task 10: Audit, Error Messages, and Production Verification

**Files:**
- Modify: `src/server/telegram-commerce.ts`
- Modify: `src/server/digital-downloads.ts`
- Modify: `integrations/python/telegram_license_bot.py`
- Modify: `tests/telegram-commerce.test.ts`
- Modify: `tests/digital-downloads.test.ts`
- Modify: `tests/test_telegram_bot.py`

- [ ] **Step 1: Add audit assertions to mutation tests**

For product create/update, checkout, proof submit/review, paid fulfillment, and download issue/reissue, assert an `AuditLog` with the expected `action`, actor Telegram ID, target type, and target ID. Ensure repeated idempotent calls do not add duplicate success audit entries.

- [ ] **Step 2: Add safe-error tests**

```py
def test_safe_error_hides_secrets_and_server_paths(self):
    message = BOT.safe_error(RuntimeError("token=secret C:\\home\\app stack trace"))
    self.assertEqual(message, "Operasi gagal. Silakan coba lagi atau hubungi admin.")
```

Implement an allowlist of buyer-safe domain errors such as expired invoice, invalid email, invalid HWID, and unavailable product. All other exceptions receive the generic message and are logged only to process output.

- [ ] **Step 3: Run complete verification locally**

Run:

```bash
python -m unittest tests.test_telegram_bot -v
npm test
npm run lint
npm run build
git diff --check
```

Expected: Python tests PASS, all Vitest files PASS, TypeScript exits zero, production builds succeed, and `git diff --check` prints no errors.

- [ ] **Step 4: Commit the audit and hardening changes**

```bash
git add src/server/telegram-commerce.ts src/server/digital-downloads.ts integrations/python/telegram_license_bot.py tests
git commit -m "fix: harden Telegram commerce operations"
```

- [ ] **Step 5: Push and deploy**

Run locally: `git push origin master`

On hosting in `/home/asistenq/repositories/asistenq`:

```bash
git fetch origin
git merge --ff-only origin/master
export PATH=/opt/alt/alt-nodejs20/root/usr/bin:$PATH
npm install
npx vite build
npx tsup src/server/index.ts --platform node --format esm --out-dir server-dist --clean
touch tmp/restart.txt
```

Restart the production Telegram bot from the admin panel after the application responds with HTTP 200.

- [ ] **Step 6: Verify the production acceptance path**

Use one owner chat and one non-owner test chat:

1. Confirm owner and buyer menus differ.
2. Create a draft license product and activate it.
3. Register the buyer with name, email, and WhatsApp.
4. Create a checkout and confirm QRIS total equals package price plus a three-digit code.
5. Confirm the invoice expires exactly 30 minutes after creation.
6. Upload a proof photo from the buyer.
7. Approve it from the owner chat.
8. Submit a 16-character HWID and confirm one license appears in Telegram and admin data.
9. Create and purchase a download product, then verify the link expires after 24 hours or rejects the fourth use.
10. Attempt an owner callback and another buyer's order from the buyer chat; both must be rejected.

Record invoice IDs used for the check and remove or expire test-only products after verification; do not delete transaction history.
