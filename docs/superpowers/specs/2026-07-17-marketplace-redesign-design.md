# AsistenQ Marketplace Redesign

**Date:** 2026-07-17  
**Status:** Approved design  
**Reference:** User-provided marketplace home and product-detail images

## Goal

Transform the current AsistenQ public site into a complete digital-product marketplace while preserving the existing admin, member, product, license, QRIS, Telegram, and fulfillment systems. The storefront must support Windows tools, downloadable files, external/web URLs, and video classes.

The visual direction follows the supplied references closely: a bright white storefront, dark emerald hero and footer, compact navigation, filterable product cards with uploaded cover art, a cart, and a structured product-detail page.

## Scope

This project includes:

- redesigned public header, marketplace home, product cards, trust sections, and footer;
- redesigned product-detail pages without reviews;
- a browser-persistent guest cart and authenticated multi-item checkout;
- one invoice and one dynamic QRIS for the combined order total plus a three-digit unique code;
- multi-item fulfillment after manual payment verification;
- expanded product/media management in the existing admin;
- editable legal, help, and company content in the existing admin;
- a basic product-update subscriber list with admin listing/export;
- compatibility with existing products, orders, licenses, custom landing pages, and member accounts.

Reviews, ratings, mass email campaigns, multi-vendor sellers, physical products, stock quantities, shipping, and marketplace commissions are explicitly out of scope.

## Public Information Architecture

### Header

The public header contains:

- AsistenQ logo and tagline;
- Marketplace, Produk, Course, and Member navigation;
- cart icon with item-count badge;
- member login button when signed out;
- member/dashboard control and logout affordance when signed in.

The header remains visible and usable on mobile through a compact responsive layout.

### Marketplace Home

The home page follows this order:

1. emerald marketplace hero with headline, supporting copy, search field, and service benefits;
2. category filter pills and sorting control;
3. paginated product grid;
4. trust/benefit strip;
5. full marketplace footer.

Search matches product name, category, headline, description, tags, and type. Filters include all products, creator tools, free tools, audio tools, YouTube workflow, e-learning, and template/assets. Sort options include newest, price ascending, price descending, and name. Desktop pagination shows eight products per page; smaller layouts retain the same logical page size while reducing the number of columns.

Each product card displays the admin-uploaded marketplace cover, category, badge, name, short description, tags, starting price, and cart action. Clicking the main card opens product detail. The cart button adds the product's default or recommended plan. Free products use a direct claim/download affordance but still require a member account before fulfillment.

If the marketplace cover is missing or fails to load, the card uses a deterministic gradient plus the product logo/name. Existing products remain visible before new media is uploaded.

### Product Detail

The product-detail page follows the supplied reference and includes:

- breadcrumb;
- large cover and gallery of screenshots or video preview;
- product name, tags, version, badge, summary, and benefit highlights;
- selectable plans in a right-hand purchase panel;
- Add to Cart and Buy Now actions;
- product metadata: developer, latest update, file size, compatibility, language, SKU, category, demo URL, and documentation URL;
- tabs for Description, Main Features, Specifications, Changelog, and FAQ;
- a trust strip below the content.

The Reviews tab is omitted. On mobile, the purchase panel moves below the core product information.

Products with an existing dedicated landing template continue to use that template unless the admin explicitly chooses the standard marketplace-detail template.

## Cart and Checkout

### Guest Cart

The cart is available before login and is stored in browser local storage. A cart item is uniquely identified by product and plan. Digital-product quantity is always one. Users can change the selected plan or remove an item.

Buy Now opens checkout for the selected item. Add to Cart preserves the current cart and allows further browsing.

### Authenticated Checkout

Login or registration is required only when checkout or free-product claim begins. After authentication, the server revalidates every product and plan. Client-provided names or prices are never trusted.

The server rejects or corrects:

- unpublished or unavailable products;
- disabled plans;
- stale prices;
- duplicate product/plan entries;
- incompatible or malformed item data.

The user receives a clear correction message before invoice creation. The cart is cleared only after successful invoice creation.

### Multi-item Orders and QRIS

New orders contain an `orderItems` collection. Each item records the product, selected plan, charged base price, fulfillment type, and fulfillment status at purchase time. Legacy single-product order fields remain readable for backward compatibility.

One checkout creates:

- one invoice number;
- one combined subtotal;
- one optional order-level discount;
- one three-digit unique code;
- one total amount;
- one dynamic QRIS payload/image.

An optional voucher is validated once against the combined eligible subtotal. The resulting discount is applied at order level before the unique code. The unique code is then applied once per invoice, not once per item. Manual payment verification remains the source of truth.

Free-only carts skip QRIS and are fulfilled immediately after a valid member claim. A mixed cart containing paid and free products follows the paid checkout flow and fulfills all items after payment approval.

### Fulfillment

When an admin marks an invoice paid, fulfillment iterates over all order items idempotently:

- licensed EXE/tool: generate or reuse the appropriate license;
- downloadable file: create member download entitlement;
- external/web URL: create member access entitlement and expose the configured URL;
- video class: enroll the member in the related class/course.

Retrying payment processing must not create duplicate licenses or entitlements. Existing Telegram/admin payment flows display and process every item in the invoice.

## Product and Media Administration

The existing admin remains the only management application. Product editing is reorganized into clear sections.

### Identity

- product name and slug;
- SKU;
- category and tags;
- product type;
- badge and badge color/type;
- draft, private, or public visibility;
- standard marketplace detail or existing custom landing template.

### Marketplace Appearance

- marketplace card cover upload;
- fallback/accent color;
- card description;
- display labels such as platform, lifetime, cloud, free, hot, or new.

### Gallery

- multiple screenshot uploads with ordering and deletion;
- optional preview video upload or video URL;
- cover selection;
- replacement cleanup so unused media does not accumulate.

### Content

- full description;
- benefit list;
- main features;
- specifications;
- changelog;
- FAQ entries;
- target-user labels.

### Technical Information

- developer;
- version;
- file size;
- compatibility;
- language;
- latest update date;
- demo URL;
- documentation URL.

### Plans and Fulfillment

- plan name, duration, price, sale price, badge, recommended flag, and active state;
- fulfillment type: license, file, URL, or class;
- fulfillment resource/configuration appropriate to the selected type.

Uploads enforce configurable size limits, allowlisted MIME types/extensions, safe filenames, and storage paths controlled by the server. Replacing or deleting media removes the superseded file only when no product still references it.

## Footer and Managed Content

The footer mirrors the supplied layout with brand information, product links, help links, company links, social links, supported payment methods, a product-update signup form, and legal links.

The admin receives a `Konten Website` section for editing these pages:

- Cara Pembelian;
- Cara Aktivasi & Pengiriman;
- Kebijakan Refund;
- Syarat & Ketentuan;
- Kebijakan Privasi;
- FAQ;
- Tentang AsistenQ;
- Kontak.

Each page has a title, slug, summary, body, publish status, and updated timestamp. Initial Indonesian content is seeded so the pages are immediately usable. The wording is operational starter content, not a claim of formal legal review.

The product-update form stores a normalized email address, consent timestamp, status, and source. The admin can view and export subscribers. Sending newsletter campaigns is not included.

## Data and Compatibility

The schema is extended rather than replaced. Existing records are normalized at load time with defaults for all new optional fields. Existing single-item orders continue to render and can be interpreted as one-item `orderItems` collections.

Public catalog responses expose only safe storefront fields. Download paths, private files, fulfillment URLs, license secrets, and unpublished content remain protected behind member/admin authorization.

Custom landing products and existing license behavior remain functional. The new standard product-detail page becomes the default for products without a custom template.

## Error Handling

- Broken/missing cover media falls back to a generated visual.
- Failed uploads return actionable size/type messages and leave the previous media intact.
- Checkout validation returns per-item corrections without creating a partial order.
- QRIS generation failure rolls back the new order or records it as a non-payable failed draft; it never returns a successful invoice and never clears the cart.
- Fulfillment records per-item status and error details so an admin can retry failed items safely.
- Content pages return a friendly not-found state when unpublished or missing.
- Subscriber submission is idempotent by normalized email.

## Verification

Verification is focused and proportional:

- unit tests for cart normalization, server price calculation, discounts, and unique-code application;
- service tests for multi-item order creation and idempotent fulfillment across all four fulfillment types;
- route tests for checkout validation, product media, managed content, and subscribers;
- component/helper tests for filtering, sorting, pagination, and cart persistence;
- one production build and lint pass;
- targeted manual responsive checks for marketplace home, product detail, cart, checkout, admin product editor, and content editor.

Existing unrelated test suites are not repeatedly rerun during each implementation step.

## Acceptance Criteria

- The public home and product detail visually match the supplied references in layout, hierarchy, spacing, white/emerald palette, cards, header, and footer.
- Admins can upload product covers/gallery media and edit all storefront/product fields.
- Guests can build a persistent cart and are asked to authenticate only at checkout.
- Multiple products produce one invoice and one QRIS with a single three-digit unique code.
- Payment approval fulfills every order item once according to its configured delivery type.
- Footer content and all required legal/help pages are editable from admin and have seeded Indonesian content.
- Existing products, members, orders, licenses, Telegram operations, and custom landing pages continue working.
