var __require = /* @__PURE__ */ ((x) => typeof require !== "undefined" ? require : typeof Proxy !== "undefined" ? new Proxy(x, {
  get: (a, b) => (typeof require !== "undefined" ? require : a)[b]
}) : x)(function(x) {
  if (typeof require !== "undefined") return require.apply(this, arguments);
  throw Error('Dynamic require of "' + x + '" is not supported');
});

// src/server/index.ts
import cors from "cors";
import express from "express";
import multer from "multer";
import AdmZip from "adm-zip";
import crypto10 from "crypto";
import fs8 from "fs";
import path8 from "path";
import { z } from "zod";

// src/shared/domain.ts
import { createHash } from "crypto";
function createId(prefix) {
  return `${prefix}_${crypto.randomUUID()}`;
}
function createProduct(input) {
  const now = (/* @__PURE__ */ new Date()).toISOString();
  const destinationType = input.destinationType ?? "internal";
  return {
    id: createId("product"),
    name: input.name,
    slug: input.slug,
    type: input.type,
    category: input.category,
    visibility: input.visibility ?? "public",
    accessMode: input.accessMode ?? "public",
    billingPeriod: input.billingPeriod,
    price: input.price,
    compareAtPrice: input.compareAtPrice,
    discountLabel: input.discountLabel,
    promoText: input.promoText,
    logoUrl: input.logoUrl ?? "",
    landingPath: input.landingPath,
    landingTemplate: input.landingTemplate,
    courseMaterials: input.courseMaterials ?? [],
    ctaLabel: input.ctaLabel,
    accessRequirement: input.accessRequirement,
    destinationType,
    externalUrl: input.externalUrl,
    openMode: input.openMode ?? (destinationType === "external" ? "new_tab" : "same_tab"),
    fulfillmentType: input.fulfillmentType,
    downloadSourceUrl: input.downloadSourceUrl,
    trackLiveUsers: input.trackLiveUsers ?? destinationType !== "external",
    active: input.active ?? true,
    featured: input.featured ?? false,
    headline: input.headline ?? input.name,
    description: input.description ?? "",
    coverUrl: input.coverUrl ?? "",
    accessUrl: input.accessUrl ?? "",
    marketplaceCoverUrl: input.marketplaceCoverUrl,
    marketplaceAccent: input.marketplaceAccent,
    cardDescription: input.cardDescription,
    tags: input.tags ?? [],
    badge: input.badge,
    gallery: input.gallery ?? [],
    benefits: input.benefits ?? [],
    features: input.features ?? [],
    specifications: input.specifications ?? {},
    changelog: input.changelog,
    productFaqs: input.productFaqs ?? [],
    targetUsers: input.targetUsers ?? [],
    developer: input.developer,
    version: input.version,
    fileSize: input.fileSize,
    compatibility: input.compatibility,
    language: input.language,
    latestUpdate: input.latestUpdate,
    sku: input.sku,
    demoUrl: input.demoUrl,
    documentationUrl: input.documentationUrl,
    createdAt: now,
    updatedAt: now
  };
}
function nextSubscriptionEnd(startsAt, billingPeriod) {
  const endsAt = new Date(startsAt);
  if (billingPeriod === "monthly") {
    endsAt.setUTCDate(endsAt.getUTCDate() + 30);
    return endsAt;
  }
  if (billingPeriod === "annual") {
    endsAt.setUTCFullYear(endsAt.getUTCFullYear() + 1);
    return endsAt;
  }
  endsAt.setUTCFullYear(endsAt.getUTCFullYear() + 100);
  return endsAt;
}
function createSubscription(input) {
  const startsAt = input.paidAt;
  const endsAt = nextSubscriptionEnd(startsAt, input.billingPeriod);
  return {
    id: createId("sub"),
    memberId: input.memberId,
    productId: input.productId,
    billingPeriod: input.billingPeriod,
    status: "active",
    startsAt: startsAt.toISOString(),
    endsAt: endsAt.toISOString(),
    createdAt: (/* @__PURE__ */ new Date()).toISOString()
  };
}
function canAdminAccess(admin, scope) {
  if (admin.role === "super_admin") {
    return true;
  }
  return admin.scopes.includes(scope);
}
function formatCurrency(amount) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0
  }).format(amount).replace(/\s/g, "");
}
function normalizeHwid(hwid) {
  return hwid.trim().toUpperCase();
}
function resolveLicenseExpiry(generatedAt, durationDays) {
  if (durationDays === null) {
    return "LIFETIME";
  }
  const expiresAt = new Date(generatedAt);
  expiresAt.setUTCDate(expiresAt.getUTCDate() + durationDays);
  const year = expiresAt.getUTCFullYear();
  const month = String(expiresAt.getUTCMonth() + 1).padStart(2, "0");
  const day = String(expiresAt.getUTCDate()).padStart(2, "0");
  return `${year}${month}${day}`;
}
function generateLicenseKey(input) {
  const normalizedHwid = normalizeHwid(input.hwid);
  const signature = createHash("sha256").update(`${normalizedHwid}${input.expiresAt}${input.salt}`, "utf8").digest("hex").slice(0, 16).toUpperCase();
  return `${input.expiresAt}-${signature}`;
}

// src/server/auth.ts
import jwt from "jsonwebtoken";
function resolveSessionSecret(env = process.env) {
  const secret = env.SESSION_SECRET?.trim();
  if (secret) return secret;
  if (env.NODE_ENV === "production") {
    throw new Error("SESSION_SECRET wajib diisi di production.");
  }
  return "local-asistenq-dev-secret";
}
var sessionSecret = resolveSessionSecret();
function signSession(user) {
  return jwt.sign(user, sessionSecret, { expiresIn: "7d" });
}
function tokenFromCookie(cookieHeader) {
  if (!cookieHeader) return void 0;
  const cookies = cookieHeader.split(";").map((item) => item.trim());
  const sessionCookie2 = cookies.find((item) => item.startsWith("asistenq_session="));
  return sessionCookie2 ? decodeURIComponent(sessionCookie2.split("=").slice(1).join("=")) : void 0;
}
function sessionCookie(token, secure = false) {
  return [
    `asistenq_session=${encodeURIComponent(token)}`,
    "Path=/",
    "Max-Age=604800",
    "HttpOnly",
    "SameSite=Lax",
    secure ? "Secure" : ""
  ].filter(Boolean).join("; ");
}
function clearSessionCookie() {
  return "asistenq_session=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax";
}
function readSession(req) {
  const header = req.header("authorization");
  const bearerToken = header?.startsWith("Bearer ") ? header.slice(7) : void 0;
  const token = bearerToken ?? tokenFromCookie(req.header("cookie"));
  if (!token) return void 0;
  try {
    return jwt.verify(token, sessionSecret);
  } catch {
    return void 0;
  }
}
function requireSession(req, res, next) {
  const user = readSession(req);
  if (!user) {
    res.status(401).json({ message: "login required" });
    return;
  }
  req.user = user;
  next();
}
function requireAdminScope(scope) {
  return (req, res, next) => {
    const user = req.user;
    if (!user || user.type !== "admin" || !user.role || !canAdminAccess({
      role: user.role,
      scopes: user.scopes ?? []
    }, scope)) {
      res.status(403).json({ message: "access denied" });
      return;
    }
    next();
  };
}

// src/server/bot-control.ts
import crypto2 from "crypto";
import fs from "fs";
import path from "path";
import { spawn } from "child_process";
var defaultPidFile = path.resolve("data/telegram-bot.pid");
var defaultScriptPath = path.resolve("integrations/python/telegram_license_bot.py");
function readPid(pidFile = defaultPidFile) {
  try {
    const pid = Number(fs.readFileSync(pidFile, "utf-8").trim());
    return Number.isInteger(pid) && pid > 0 ? pid : void 0;
  } catch {
    return void 0;
  }
}
function defaultIsProcessAlive(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}
function botMissingMessage(store2) {
  const settings2 = store2.data.deploymentSettings ?? {};
  const missing = [
    settings2.telegramBotToken || process.env.TELEGRAM_BOT_TOKEN ? "" : "Token Telegram",
    settings2.telegramOwnerId || process.env.TELEGRAM_OWNER_ID ? "" : "Owner ID"
  ].filter(Boolean);
  return missing.length ? `Belum lengkap: ${missing.join(", ")}.` : "";
}
function ensureBotSecret(store2) {
  const current = store2.data.deploymentSettings ?? {};
  if (current.botApiSecret) return current.botApiSecret;
  store2.data.deploymentSettings = {
    githubRepo: current.githubRepo ?? "effands/asistenq",
    githubBranch: current.githubBranch ?? "master",
    ...current,
    botApiSecret: crypto2.randomBytes(24).toString("hex"),
    updatedAt: (/* @__PURE__ */ new Date()).toISOString()
  };
  store2.save();
  return store2.data.deploymentSettings.botApiSecret ?? "";
}
function getTelegramBotStatus(store2, options = {}) {
  const pidFile = options.pidFile ?? defaultPidFile;
  const isProcessAlive = options.isProcessAlive ?? defaultIsProcessAlive;
  const missing = botMissingMessage(store2);
  const pid = readPid(pidFile);
  const running = Boolean(pid && isProcessAlive(pid));
  if (pid && !running) {
    fs.rmSync(pidFile, { force: true });
  }
  return {
    configured: !missing,
    running,
    ...running && pid ? { pid } : {},
    message: running ? "Bot Telegram berjalan." : missing || "Bot Telegram belum jalan."
  };
}
function startTelegramBot(store2, options = {}) {
  const pidFile = options.pidFile ?? defaultPidFile;
  const scriptPath = options.scriptPath ?? defaultScriptPath;
  const current = getTelegramBotStatus(store2, options);
  if (!current.configured) return current;
  if (current.running) return current;
  if (!fs.existsSync(scriptPath)) {
    return { configured: true, running: false, message: "File bot Python belum ditemukan." };
  }
  const settings2 = store2.data.deploymentSettings ?? {};
  const command2 = process.platform === "win32" ? "python" : "python3";
  const botSecret = ensureBotSecret(store2);
  const child = (options.spawnProcess ?? spawn)(command2, [scriptPath], {
    cwd: process.cwd(),
    detached: true,
    stdio: "ignore",
    env: {
      ...process.env,
      TELEGRAM_BOT_TOKEN: settings2.telegramBotToken ?? process.env.TELEGRAM_BOT_TOKEN ?? "",
      TELEGRAM_OWNER_ID: settings2.telegramOwnerId ?? process.env.TELEGRAM_OWNER_ID ?? "",
      ASISTENQ_BOT_SECRET: botSecret,
      ASISTENQ_API_BASE: process.env.ASISTENQ_API_BASE ?? (process.env.NODE_ENV === "production" ? "https://asistenq.com/api" : `http://127.0.0.1:${process.env.API_PORT ?? 4e3}/api`)
    }
  });
  child.unref();
  fs.mkdirSync(path.dirname(pidFile), { recursive: true });
  fs.writeFileSync(pidFile, String(child.pid ?? ""), "utf-8");
  return { configured: true, running: true, pid: child.pid, message: "Bot Telegram berjalan." };
}
function stopTelegramBot(options = {}) {
  const pidFile = options.pidFile ?? defaultPidFile;
  const pid = readPid(pidFile);
  if (pid) {
    try {
      (options.killProcess ?? ((targetPid) => process.kill(targetPid, "SIGTERM")))(pid);
    } catch {
    }
  }
  fs.rmSync(pidFile, { force: true });
  return { configured: true, running: false, message: pid ? "Bot Telegram dihentikan." : "Bot Telegram belum jalan." };
}

// src/server/deploy.ts
import { execFile } from "child_process";
import { spawn as spawn2 } from "child_process";
import { promisify } from "util";
var execFileAsync = promisify(execFile);
var githubRepoPattern = /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/;
var githubBranchPattern = /^[A-Za-z0-9._/-]+$/;
function parseDeploymentSettings(input) {
  const githubRepo = (input.githubRepo ?? "effands/asistenq").trim();
  const githubBranch = (input.githubBranch ?? "master").trim();
  if (!githubRepoPattern.test(githubRepo)) {
    throw new Error("Repository GitHub tidak valid. Gunakan format owner/repo.");
  }
  if (!githubBranchPattern.test(githubBranch) || githubBranch.includes("..") || githubBranch.startsWith("/") || githubBranch.endsWith("/") || githubBranch.endsWith(".")) {
    throw new Error("Branch GitHub tidak valid.");
  }
  return { githubRepo, githubBranch };
}
function buildGitHubRemote(githubRepo, githubToken) {
  if (!githubToken) return "origin";
  return `https://x-access-token:${encodeURIComponent(githubToken)}@github.com/${githubRepo}.git`;
}
function deploymentInstallArgs(hasLockfile = true) {
  const sharedArgs = ["--include=dev", "--no-audit", "--no-fund"];
  return hasLockfile ? ["ci", ...sharedArgs] : ["install", ...sharedArgs];
}
function deploymentAuditArgs() {
  return ["audit", "--audit-level=low"];
}
function deploymentPullArgs(remote, branch) {
  return ["pull", "--no-rebase", "--autostash", remote, branch];
}
function shellQuote(value) {
  return `'${value.replace(/'/g, `'\\''`)}'`;
}
function buildPassengerRestartScript(appRoot) {
  const normalizedAppRoot = appRoot.replace(/\\/g, "/");
  const passengerPattern = `lsnode:${normalizedAppRoot}`;
  return [
    "mkdir -p tmp",
    "touch tmp/restart.txt",
    `(pkill -f ${shellQuote(passengerPattern)} || true)`
  ].join(" && ");
}
function schedulePassengerRestart(appRoot) {
  const script = `cd ${shellQuote(appRoot)} && ${buildPassengerRestartScript(appRoot)}`;
  const child = spawn2("bash", ["-lc", script], {
    detached: true,
    stdio: "ignore"
  });
  child.unref();
}
async function runCommand(command2, args, options) {
  const executable = process.platform === "win32" && command2 === "npm" ? "npm.cmd" : command2;
  return execFileAsync(executable, args, options);
}

// src/server/payment-proof-storage.ts
import fs2 from "fs";
import path2 from "path";
function removePaymentProof(directory, storedName) {
  const fileName = storedName ? path2.basename(storedName) : "";
  if (!fileName) return { files: 0, bytes: 0 };
  const filePath = path2.join(directory, fileName);
  if (!fs2.existsSync(filePath)) return { files: 0, bytes: 0 };
  const stat = fs2.statSync(filePath);
  if (!stat.isFile()) return { files: 0, bytes: 0 };
  fs2.rmSync(filePath, { force: true });
  return { files: 1, bytes: stat.size };
}
function clearPaymentProofDirectory(directory) {
  fs2.mkdirSync(directory, { recursive: true });
  const result = { files: 0, bytes: 0 };
  for (const entry of fs2.readdirSync(directory, { withFileTypes: true })) {
    if (!entry.isFile()) continue;
    const removed = removePaymentProof(directory, entry.name);
    result.files += removed.files;
    result.bytes += removed.bytes;
  }
  return result;
}

// src/server/services.ts
import bcrypt from "bcryptjs";
import crypto3 from "crypto";

// src/server/qris.ts
import QRCode from "qrcode";
function parseTopLevelTags(payloadWithoutCrcValue) {
  const tags = [];
  let offset = 0;
  while (offset < payloadWithoutCrcValue.length) {
    const id = payloadWithoutCrcValue.slice(offset, offset + 2);
    const lengthText = payloadWithoutCrcValue.slice(offset + 2, offset + 4);
    if (!/^\d{2}$/.test(id) || !/^\d{2}$/.test(lengthText)) {
      throw new Error("struktur QRIS tidak valid.");
    }
    const length = Number(lengthText);
    const valueStart = offset + 4;
    const valueEnd = valueStart + length;
    if (valueEnd > payloadWithoutCrcValue.length) {
      throw new Error("struktur QRIS tidak valid.");
    }
    tags.push({ id, length, value: payloadWithoutCrcValue.slice(valueStart, valueEnd) });
    offset = valueEnd;
  }
  return tags;
}
function calculateQrisCrc(input) {
  let crc = 65535;
  for (let index = 0; index < input.length; index += 1) {
    crc ^= input.charCodeAt(index) << 8;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc & 32768) !== 0 ? crc << 1 ^ 4129 : crc << 1;
      crc &= 65535;
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, "0");
}
function isValidQrisCrc(payload) {
  if (!/6304[0-9A-F]{4}$/i.test(payload)) return false;
  return calculateQrisCrc(payload.slice(0, -4)) === payload.slice(-4).toUpperCase();
}
function validateStaticQrisPayload(input) {
  const payload = input.trim();
  if (!payload.includes("010211")) throw new Error("QRIS harus bertipe statis.");
  if (!payload.includes("5802ID") || !payload.includes("6304")) throw new Error("struktur QRIS tidak valid.");
  if (!isValidQrisCrc(payload)) throw new Error("CRC QRIS tidak valid.");
  const tags = parseTopLevelTags(payload);
  if (tags.filter((tag) => tag.id === "01" && tag.value === "11").length !== 1) {
    throw new Error("QRIS harus bertipe statis.");
  }
  if (tags.some((tag) => tag.id === "54")) {
    throw new Error("struktur QRIS memiliki nominal yang ambigu.");
  }
  if (tags.filter((tag) => tag.id === "58" && tag.value === "ID").length !== 1) {
    throw new Error("struktur QRIS tidak valid.");
  }
  return payload;
}
function buildDynamicQrisPayload(staticPayload, amount) {
  if (!Number.isSafeInteger(amount) || amount <= 0) {
    throw new Error("nominal QRIS harus berupa bilangan bulat positif.");
  }
  const source = validateStaticQrisPayload(staticPayload);
  const withoutCrc = source.slice(0, -4).replace("010211", "010212");
  const countryMarker = "5802ID";
  const markerIndex = withoutCrc.indexOf(countryMarker);
  if (markerIndex < 0 || withoutCrc.indexOf(countryMarker, markerIndex + 1) >= 0) {
    throw new Error("struktur QRIS tidak valid.");
  }
  const amountText = String(amount);
  const amountTag = `54${amountText.length.toString().padStart(2, "0")}${amountText}`;
  const output = `${withoutCrc.slice(0, markerIndex)}${amountTag}${withoutCrc.slice(markerIndex)}`;
  return `${output}${calculateQrisCrc(output)}`;
}
async function generateDynamicQris(staticPayload, amount) {
  const payload = buildDynamicQrisPayload(staticPayload, amount);
  const dataUrl = await QRCode.toDataURL(payload, {
    errorCorrectionLevel: "M",
    margin: 2,
    width: 320
  });
  return { payload, dataUrl };
}

// src/server/cart-checkout.ts
function validateCart(store2, input, now = /* @__PURE__ */ new Date()) {
  if (input.items.length < 1 || input.items.length > 25) throw new Error("keranjang harus berisi 1 sampai 25 produk");
  const seen = /* @__PURE__ */ new Set();
  const items = input.items.map(({ productId, planId }, index) => {
    const key = `${productId}:${planId}`;
    if (seen.has(key)) throw new Error("item keranjang duplikat");
    seen.add(key);
    const product = store2.data.products.find((row) => row.id === productId && row.active && row.visibility === "public");
    const plan = store2.data.plans.find((row) => row.id === planId && row.productId === productId && row.isActive);
    if (!product || !plan) throw new Error("produk atau paket tidak tersedia");
    return {
      id: `item_${index + 1}`,
      productId,
      planId,
      productName: product.name,
      planName: plan.name,
      unitAmount: plan.price,
      fulfillmentType: product.fulfillmentType ?? "license",
      fulfillmentStatus: "pending"
    };
  });
  const subtotal = items.reduce((sum, item) => sum + item.unitAmount, 0);
  let discountAmount = 0;
  let voucherId;
  if (input.voucherCode?.trim()) {
    const code = input.voucherCode.trim().toUpperCase();
    const voucher = store2.data.vouchers.find((row) => row.code === code && row.active && (!row.expiresAt || new Date(row.expiresAt) >= now) && (row.maxUse === null || row.usedCount < row.maxUse));
    if (!voucher) throw new Error("voucher tidak valid");
    const eligible = voucher.productId ? items.filter((item) => item.productId === voucher.productId).reduce((sum, item) => sum + item.unitAmount, 0) : subtotal;
    if (eligible <= 0) throw new Error("voucher tidak berlaku untuk keranjang ini");
    discountAmount = voucher.discountType === "percent" ? Math.floor(eligible * Math.min(voucher.discountValue, 100) / 100) : Math.min(eligible, voucher.discountValue);
    voucherId = voucher.id;
  }
  return { items, subtotal, discountAmount, amount: subtotal - discountAmount, voucherId };
}

// src/server/services.ts
function normalizeEmail(email) {
  return email.trim().toLowerCase();
}
function escapeHtml(value) {
  return String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#39;");
}
function hashResetToken(token) {
  return crypto3.createHash("sha256").update(token).digest("hex");
}
function createResetToken() {
  return crypto3.randomBytes(24).toString("hex");
}
function assertSuperAdmin(actor) {
  if (actor.role !== "super_admin") {
    throw new Error("super admin access required");
  }
}
function findProductBySlug(store2, productSlug) {
  const product = store2.data.products.find((item) => item.slug === productSlug);
  if (!product) {
    throw new Error("product not found");
  }
  return product;
}
function findPlanByCode(store2, productId, planCode) {
  const normalizedCode = planCode.trim().toUpperCase();
  const plan = store2.data.plans.find((item) => item.productId === productId && item.code === normalizedCode && item.isActive);
  if (!plan) {
    throw new Error("plan not found");
  }
  return plan;
}
function formatExpiryDate(expiryCode) {
  if (expiryCode === "LIFETIME") {
    return null;
  }
  return `${expiryCode.slice(0, 4)}-${expiryCode.slice(4, 6)}-${expiryCode.slice(6, 8)}`;
}
function expiryCodeFromLicense(license) {
  if (!license.expiresAt) {
    return "LIFETIME";
  }
  return license.expiresAt.replaceAll("-", "");
}
function productPlanRow(store2, plan) {
  const product = store2.data.products.find((item) => item.id === plan.productId);
  return {
    ...plan,
    productSlug: product?.slug ?? "",
    productName: product?.name ?? plan.productId,
    formattedPrice: formatCurrency(plan.price)
  };
}
function licenseDashboardRow(store2, license) {
  const product = store2.data.products.find((item) => item.id === license.productId);
  const plan = store2.data.plans.find((item) => item.id === license.planId);
  const isBanned = store2.data.bannedHwids.some((item) => item.productId === license.productId && item.hwid === license.hwid);
  return {
    ...license,
    status: isBanned ? "banned" : license.status,
    product: product ? {
      id: product.id,
      name: product.name,
      slug: product.slug,
      type: product.type,
      category: product.category,
      accessUrl: product.accessUrl
    } : void 0,
    plan: plan ? {
      id: plan.id,
      code: plan.code,
      name: plan.name,
      price: plan.price,
      billingPeriod: plan.billingPeriod,
      durationDays: plan.durationDays,
      formattedPrice: formatCurrency(plan.price)
    } : void 0,
    activationUrl: "/api/license/activate",
    verifyUrl: "/api/license/verify"
  };
}
async function createAdmin(store2, input) {
  assertSuperAdmin(input.actor);
  const email = normalizeEmail(input.email);
  if (store2.data.admins.some((admin2) => admin2.email === email)) {
    throw new Error("email already exists");
  }
  const admin = {
    id: createId("admin"),
    name: input.name,
    email,
    passwordHash: await bcrypt.hash(input.password, 12),
    role: input.role,
    scopes: input.scopes,
    active: true,
    createdAt: (/* @__PURE__ */ new Date()).toISOString()
  };
  store2.data.admins.push(admin);
  store2.save();
  return admin;
}
async function createMember(store2, input) {
  const email = normalizeEmail(input.email);
  if (store2.data.members.some((member2) => member2.email === email)) {
    throw new Error("email already exists");
  }
  const member = {
    id: createId("member"),
    name: input.name,
    email,
    whatsapp: input.whatsapp?.trim() ?? "",
    telegramId: input.telegramId?.trim() ?? "",
    passwordHash: await bcrypt.hash(input.password, 12),
    active: true,
    createdAt: (/* @__PURE__ */ new Date()).toISOString()
  };
  store2.data.members.push(member);
  store2.save();
  return member;
}
async function verifyAdminLogin(store2, emailInput, password) {
  const email = normalizeEmail(emailInput);
  const admin = store2.data.admins.find((item) => item.email === email && item.active);
  if (!admin || !await bcrypt.compare(password, admin.passwordHash)) {
    throw new Error("invalid credentials");
  }
  return admin;
}
async function verifyMemberLogin(store2, emailInput, password) {
  const email = normalizeEmail(emailInput);
  const member = store2.data.members.find((item) => item.email === email && item.active);
  if (!member || !await bcrypt.compare(password, member.passwordHash)) {
    throw new Error("invalid credentials");
  }
  return member;
}
async function requestPasswordReset(store2, input) {
  const email = normalizeEmail(input.email);
  const account = input.accountType === "admin" ? store2.data.admins.find((item) => item.email === email && item.active) : store2.data.members.find((item) => item.email === email && item.active);
  if (!account) {
    return { ok: true };
  }
  const now = input.now ?? /* @__PURE__ */ new Date();
  const token = createResetToken();
  const expiresAt = new Date(now.getTime() + 30 * 60 * 1e3).toISOString();
  store2.data.passwordResets.filter((item) => item.accountType === input.accountType && item.accountId === account.id && !item.usedAt).forEach((item) => {
    item.usedAt = now.toISOString();
  });
  store2.data.passwordResets.push({
    id: createId("reset"),
    accountType: input.accountType,
    accountId: account.id,
    email,
    tokenHash: hashResetToken(token),
    expiresAt,
    createdAt: now.toISOString()
  });
  store2.save();
  const baseUrl = process.env.APP_URL ?? "http://127.0.0.1:4000";
  const path9 = input.accountType === "admin" ? "/adminasistenq" : "/member";
  return {
    ok: true,
    expiresAt,
    resetUrl: `${baseUrl}${path9}?reset=${token}&type=${input.accountType}`
  };
}
async function resetPassword(store2, input) {
  const now = input.now ?? /* @__PURE__ */ new Date();
  const tokenHash = hashResetToken(input.token);
  const reset = store2.data.passwordResets.find((item) => item.accountType === input.accountType && item.tokenHash === tokenHash && !item.usedAt);
  if (!reset || new Date(reset.expiresAt) < now) {
    throw new Error("reset link tidak valid atau sudah kedaluwarsa");
  }
  const account = input.accountType === "admin" ? store2.data.admins.find((item) => item.id === reset.accountId && item.active) : store2.data.members.find((item) => item.id === reset.accountId && item.active);
  if (!account) {
    throw new Error("akun tidak ditemukan");
  }
  account.passwordHash = await bcrypt.hash(input.password, 12);
  reset.usedAt = now.toISOString();
  store2.save();
  return { ok: true };
}
function createProductRecord(store2, input) {
  if (store2.data.products.some((product2) => product2.slug === input.slug)) {
    throw new Error("product slug already exists");
  }
  const product = createProduct(input);
  store2.data.products.push(product);
  for (const plan of input.plans ?? []) {
    if (plan.isActive === false) continue;
    store2.data.plans.push({
      id: createId("plan"),
      productId: product.id,
      code: plan.code.trim().toUpperCase(),
      name: plan.name,
      price: plan.price,
      billingPeriod: plan.billingPeriod,
      durationDays: plan.durationDays,
      isFree: plan.isFree ?? plan.price === 0,
      isActive: true,
      badge: plan.badge,
      highlighted: plan.highlighted,
      sortOrder: plan.sortOrder
    });
  }
  store2.save();
  return product;
}
function updateProductRecord(store2, productId, input) {
  const product = store2.data.products.find((item) => item.id === productId);
  if (!product) {
    throw new Error("product not found");
  }
  if (input.slug && input.slug !== product.slug && store2.data.products.some((item) => item.slug === input.slug)) {
    throw new Error("product slug already exists");
  }
  Object.assign(product, {
    ...input,
    updatedAt: (/* @__PURE__ */ new Date()).toISOString()
  });
  store2.save();
  return product;
}
function deleteProductRecord(store2, productId) {
  const product = store2.data.products.find((item) => item.id === productId);
  if (!product) throw new Error("product not found");
  const hasCustomerData = store2.data.orders.some((order) => order.productId === productId || order.orderItems?.some((item) => item.productId === productId)) || store2.data.licenses.some((license) => license.productId === productId) || store2.data.subscriptions.some((subscription) => subscription.productId === productId) || store2.data.accessGrants.some((grant) => grant.productId === productId) || store2.data.downloadGrants.some((grant) => grant.productId === productId);
  if (hasCustomerData) throw new Error("Produk sudah memiliki transaksi atau akses member. Ubah visibilitas menjadi Draft jika ingin menyembunyikannya.");
  store2.data.products = store2.data.products.filter((item) => item.id !== productId);
  store2.data.plans = store2.data.plans.filter((item) => item.productId !== productId);
  store2.data.vouchers = store2.data.vouchers.filter((item) => item.productId !== productId);
  store2.data.announcements = store2.data.announcements.filter((item) => item.productId !== productId);
  store2.data.bannedHwids = store2.data.bannedHwids.filter((item) => item.productId !== productId);
  store2.data.toolAnalyticsEvents = store2.data.toolAnalyticsEvents.filter((item) => item.productId !== productId);
  store2.save();
  return product;
}
function createPlanRecord(store2, input) {
  if (!store2.data.products.some((product) => product.id === input.productId)) {
    throw new Error("product not found");
  }
  const code = input.code.trim().toUpperCase();
  const existingPlan = store2.data.plans.find((plan2) => plan2.productId === input.productId && plan2.code === code);
  if (existingPlan) {
    return existingPlan;
  }
  const plan = {
    id: createId("plan"),
    productId: input.productId,
    code,
    name: input.name,
    price: input.price,
    billingPeriod: input.billingPeriod,
    durationDays: input.durationDays,
    isFree: input.isFree ?? input.price === 0,
    isActive: input.isActive ?? true,
    badge: input.badge,
    highlighted: input.highlighted ?? false,
    sortOrder: input.sortOrder
  };
  store2.data.plans.push(plan);
  store2.save();
  return plan;
}
function updatePlanRecord(store2, planId, input) {
  const plan = store2.data.plans.find((item) => item.id === planId);
  if (!plan) throw new Error("plan not found");
  if (input.price !== void 0 && (!Number.isInteger(input.price) || input.price < 0)) throw new Error("harga tidak valid");
  if (input.durationDays !== void 0 && input.durationDays !== null && (!Number.isInteger(input.durationDays) || input.durationDays <= 0)) throw new Error("durasi tidak valid");
  if (input.sortOrder !== void 0 && !Number.isInteger(input.sortOrder)) throw new Error("urutan tidak valid");
  if (input.highlighted) {
    store2.data.plans.filter((item) => item.productId === plan.productId && item.id !== plan.id).forEach((item) => {
      item.highlighted = false;
    });
  }
  Object.assign(plan, input);
  if (plan.badge !== void 0) plan.badge = plan.badge.trim() || void 0;
  store2.save();
  return plan;
}
var invoiceLifetimeHours = 24;
var invoiceReminderHours = 3;
var checkoutQueues = /* @__PURE__ */ new WeakMap();
async function serializeCheckout(store2, operation) {
  const previous = checkoutQueues.get(store2) ?? Promise.resolve();
  const result = previous.then(operation);
  const tail = result.then(() => void 0, () => void 0);
  checkoutQueues.set(store2, tail);
  try {
    return await result;
  } finally {
    if (checkoutQueues.get(store2) === tail) checkoutQueues.delete(store2);
  }
}
function allocateUniquePaymentCode(store2, now) {
  const usedCodes = new Set(store2.data.orders.filter((order) => {
    if (order.status !== "pending" || order.uniqueCode === void 0) return false;
    const expiresAt = order.expiresAt ? new Date(order.expiresAt) : new Date(new Date(order.createdAt).getTime() + invoiceLifetimeHours * 60 * 60 * 1e3);
    return expiresAt > now;
  }).map((order) => order.uniqueCode));
  const firstCode = Math.floor(Math.random() * 900) + 100;
  for (let offset = 0; offset < 900; offset += 1) {
    const candidate = 100 + (firstCode - 100 + offset) % 900;
    if (!usedCodes.has(candidate)) return candidate;
  }
  throw new Error("kode unik pembayaran tidak tersedia");
}
async function createCheckout(store2, memberId, productId, now = /* @__PURE__ */ new Date(), options = {}) {
  return serializeCheckout(store2, () => createCheckoutLocked(store2, memberId, productId, now, options));
}
async function createCartCheckout(store2, memberId, input, now = /* @__PURE__ */ new Date()) {
  return serializeCheckout(store2, async () => {
    const member = store2.data.members.find((row) => row.id === memberId && row.active);
    if (!member) throw new Error("member not found");
    const validated = validateCart(store2, input, now);
    const uniqueCode = validated.amount > 0 ? allocateUniquePaymentCode(store2, now) : 0;
    const totalAmount = validated.amount + uniqueCode;
    const generatedQris = validated.amount > 0 ? await generateDynamicQris(store2.data.deploymentSettings?.qrisStaticPayload ?? "", totalAmount) : void 0;
    const invoiceNumber = `INV-${now.toISOString().slice(0, 10).replace(/-/g, "")}-${String(store2.data.orders.length + 1).padStart(4, "0")}`;
    const first = validated.items[0];
    const order = {
      id: createId("order"),
      memberId,
      productId: first.productId,
      planId: first.planId,
      productName: first.productName,
      customerEmail: member.email,
      customerHwid: input.customerHwid ? normalizeHwid(input.customerHwid) : void 0,
      orderItems: validated.items.map((item) => ({ ...item, id: createId("order_item") })),
      invoiceNumber,
      uniqueCode,
      amount: validated.subtotal,
      discountAmount: validated.discountAmount,
      voucherId: validated.voucherId,
      totalAmount,
      status: "pending",
      qrisPayload: generatedQris?.payload ?? "",
      paymentQrUrl: generatedQris?.dataUrl,
      paymentProofStatus: "none",
      createdAt: now.toISOString(),
      expiresAt: new Date(now.getTime() + invoiceLifetimeHours * 60 * 60 * 1e3).toISOString()
    };
    store2.data.orders.push(order);
    if (validated.voucherId) {
      const voucher = store2.data.vouchers.find((row) => row.id === validated.voucherId);
      if (voucher) voucher.usedCount += 1;
    }
    store2.save();
    return order;
  });
}
function orderAccessToken(orderId, idempotencyKey) {
  const secret = process.env.ORDER_ACCESS_SECRET ?? process.env.SESSION_SECRET ?? "asistenq-local-order-access";
  return crypto3.createHmac("sha256", secret).update(`${orderId}:${idempotencyKey}`).digest("hex");
}
function canAccessLicenseOrder(order, token) {
  if (!order.accessTokenHash || !token) return false;
  const candidate = crypto3.createHash("sha256").update(token).digest("hex");
  const left = Buffer.from(candidate, "hex");
  const right = Buffer.from(order.accessTokenHash, "hex");
  return left.length === right.length && crypto3.timingSafeEqual(left, right);
}
async function createLicenseCheckout(store2, input, now = /* @__PURE__ */ new Date()) {
  expirePendingOrders(store2, now);
  const product = findProductBySlug(store2, input.productSlug);
  const plan = findPlanByCode(store2, product.id, input.planCode);
  if (!plan.isActive) throw new Error("paket tidak aktif");
  const email = normalizeEmail(input.email);
  const hwid = normalizeHwid(input.hwid);
  const idempotencyKey = input.idempotencyKey.trim();
  if (!idempotencyKey) throw new Error("idempotency key wajib diisi");
  const reusable = store2.data.orders.find((item) => item.productId === product.id && item.planId === plan.id && item.idempotencyKey === idempotencyKey && item.customerEmail === email && item.customerHwid === hwid && item.status === "pending" && Boolean(item.expiresAt && new Date(item.expiresAt) > now));
  if (reusable) return { order: reusable, accessToken: orderAccessToken(reusable.id, idempotencyKey) };
  let member = store2.data.members.find((item) => item.email === email);
  if (!member) {
    member = await createMember(store2, {
      name: email.split("@")[0] || "VJ Studio Buyer",
      email,
      password: crypto3.randomBytes(24).toString("base64url")
    });
  }
  let price = plan.price;
  let voucherId;
  let discountAmount = 0;
  if (input.voucherCode?.trim()) {
    const result = verifyVoucher(store2, { productSlug: product.slug, code: input.voucherCode });
    if (!result.valid || !result.voucher) throw new Error(result.message ?? "Voucher tidak valid.");
    voucherId = result.voucher.id;
    discountAmount = result.voucher.discountType === "percent" ? Math.floor(price * Math.min(result.voucher.discountValue, 100) / 100) : Math.min(price, result.voucher.discountValue);
    price -= discountAmount;
  }
  const order = await createCheckout(store2, member.id, product.id, now, {
    planId: plan.id,
    price,
    lifetimeMinutes: 30
  });
  const accessToken = orderAccessToken(order.id, idempotencyKey);
  Object.assign(order, {
    customerEmail: email,
    customerHwid: hwid,
    idempotencyKey,
    accessTokenHash: crypto3.createHash("sha256").update(accessToken).digest("hex"),
    voucherId,
    discountAmount
  });
  store2.save();
  return { order, accessToken };
}
async function createCheckoutLocked(store2, memberId, productId, now, options) {
  const member = store2.data.members.find((item) => item.id === memberId);
  const product = store2.data.products.find((item) => item.id === productId && item.active);
  if (!member) {
    throw new Error("member not found");
  }
  if (!product) {
    throw new Error("product not found");
  }
  if (options.reusePending) {
    expirePendingOrders(store2, now);
    const reusable = store2.data.orders.find((order2) => order2.memberId === memberId && order2.productId === productId && order2.planId === options.planId && order2.status === "pending" && Boolean(order2.expiresAt && new Date(order2.expiresAt) > now));
    if (reusable) return reusable;
  }
  const amount = options.price ?? product.price;
  const uniqueCode = amount > 0 ? allocateUniquePaymentCode(store2, now) : 0;
  const totalAmount = amount + uniqueCode;
  const invoiceNumber = `INV-${now.toISOString().slice(0, 10).replace(/-/g, "")}-${String(store2.data.orders.length + 1).padStart(4, "0")}`;
  const lifetimeMs = options.lifetimeMinutes === void 0 ? invoiceLifetimeHours * 60 * 60 * 1e3 : options.lifetimeMinutes * 60 * 1e3;
  const expiresAt = new Date(now.getTime() + lifetimeMs).toISOString();
  const generatedQris = amount > 0 ? await generateDynamicQris(store2.data.deploymentSettings?.qrisStaticPayload ?? "", totalAmount) : void 0;
  const order = {
    id: createId("order"),
    memberId,
    productId,
    invoiceNumber,
    productName: product.name,
    planId: options.planId,
    telegramId: options.telegramId,
    uniqueCode,
    amount,
    totalAmount,
    status: "pending",
    qrisPayload: generatedQris?.payload ?? "",
    paymentQrUrl: generatedQris?.dataUrl,
    paymentProofStatus: "none",
    createdAt: now.toISOString(),
    expiresAt
  };
  store2.data.orders.push(order);
  store2.save();
  return order;
}
function expirePendingOrders(store2, now = /* @__PURE__ */ new Date()) {
  let count = 0;
  for (const order of store2.data.orders) {
    const expiresAt = order.expiresAt ? new Date(order.expiresAt) : new Date(new Date(order.createdAt).getTime() + invoiceLifetimeHours * 60 * 60 * 1e3);
    if (order.status === "pending" && expiresAt < now) {
      order.status = "expired";
      order.expiresAt = expiresAt.toISOString();
      count += 1;
    }
  }
  if (count > 0) store2.save();
  return count;
}
function generateToolLicense(store2, input) {
  const product = findProductBySlug(store2, input.productSlug);
  const plan = findPlanByCode(store2, product.id, input.planCode);
  const now = input.now ?? /* @__PURE__ */ new Date();
  const expiresAt = resolveLicenseExpiry(now, plan.durationDays);
  const key = generateLicenseKey({
    hwid: input.hwid,
    expiresAt,
    salt: input.salt ?? process.env.LICENSE_SECRET_SALT ?? "vjstudio_secret_salt_2026_xyz"
  });
  const license = {
    id: createId("license"),
    productId: product.id,
    planId: plan.id,
    email: normalizeEmail(input.email),
    hwid: normalizeHwid(input.hwid),
    key,
    status: "generated",
    generatedAt: now.toISOString(),
    expiresAt: formatExpiryDate(expiresAt)
  };
  store2.data.licenses.push(license);
  store2.save();
  return license;
}
function isHwidBanned(store2, productId, hwid) {
  const normalized = normalizeHwid(hwid);
  return store2.data.bannedHwids.some((item) => item.productId === productId && item.hwid === normalized);
}
function activateLicense(store2, input) {
  const product = findProductBySlug(store2, input.productSlug);
  const normalizedHwid = normalizeHwid(input.hwid);
  if (isHwidBanned(store2, product.id, normalizedHwid)) {
    throw new Error("HWID is banned");
  }
  const license = store2.data.licenses.find((item) => item.productId === product.id && item.key === input.token.trim() && item.hwid === normalizedHwid);
  if (!license) {
    throw new Error("Invalid license");
  }
  license.status = "active";
  license.activatedAt = (input.now ?? /* @__PURE__ */ new Date()).toISOString();
  store2.save();
  return { status: "success", message: "Activated" };
}
function verifyLicense(store2, input) {
  const product = findProductBySlug(store2, input.productSlug);
  const normalizedHwid = normalizeHwid(input.hwid);
  if (isHwidBanned(store2, product.id, normalizedHwid)) {
    return { valid: false, message: "HWID is banned" };
  }
  const license = store2.data.licenses.find((item) => item.productId === product.id && item.key === input.token.trim() && item.hwid === normalizedHwid);
  if (!license) {
    return { valid: false, message: "Invalid license" };
  }
  return {
    valid: license.status === "active" || license.status === "generated",
    status: license.status
  };
}
function banHwid(store2, input) {
  const product = findProductBySlug(store2, input.productSlug);
  const normalizedHwid = normalizeHwid(input.hwid);
  const existing = store2.data.bannedHwids.find((item) => item.productId === product.id && item.hwid === normalizedHwid);
  if (existing) {
    return existing;
  }
  const banned = {
    id: createId("ban"),
    productId: product.id,
    hwid: normalizedHwid,
    reason: input.reason,
    createdAt: (/* @__PURE__ */ new Date()).toISOString()
  };
  store2.data.bannedHwids.push(banned);
  store2.data.licenses.filter((license) => license.productId === product.id && license.hwid === normalizedHwid).forEach((license) => {
    license.status = "banned";
  });
  store2.save();
  return banned;
}
function unbanHwid(store2, input) {
  const product = findProductBySlug(store2, input.productSlug);
  const normalizedHwid = normalizeHwid(input.hwid);
  const previousLength = store2.data.bannedHwids.length;
  store2.data.bannedHwids = store2.data.bannedHwids.filter((item) => item.productId !== product.id || item.hwid !== normalizedHwid);
  store2.save();
  return { removed: store2.data.bannedHwids.length < previousLength };
}
function resetLicenseDevice(store2, input) {
  const license = store2.data.licenses.find((item) => item.id === input.licenseId);
  if (!license) {
    throw new Error("license not found");
  }
  const oldHwid = license.hwid;
  if (oldHwid === normalizeHwid(input.newHwid)) {
    throw new Error("new HWID must be different");
  }
  const existingBan = store2.data.bannedHwids.find((item) => item.productId === license.productId && item.hwid === oldHwid);
  if (!existingBan) {
    store2.data.bannedHwids.push({
      id: createId("ban"),
      productId: license.productId,
      hwid: oldHwid,
      reason: "device reset",
      createdAt: (/* @__PURE__ */ new Date()).toISOString()
    });
  }
  license.hwid = normalizeHwid(input.newHwid);
  license.key = generateLicenseKey({
    hwid: license.hwid,
    expiresAt: expiryCodeFromLicense(license),
    salt: input.salt ?? process.env.LICENSE_SECRET_SALT ?? "vjstudio_secret_salt_2026_xyz"
  });
  license.status = "generated";
  delete license.activatedAt;
  store2.save();
  return license;
}
function adminLicenseDashboard(store2) {
  return {
    licenses: store2.data.licenses.map((license) => licenseDashboardRow(store2, license)).sort((a, b) => b.generatedAt.localeCompare(a.generatedAt)),
    plans: store2.data.plans.map((plan) => productPlanRow(store2, plan)),
    bannedHwids: store2.data.bannedHwids
  };
}
function memberLicenseDashboard(store2, memberId) {
  const member = store2.data.members.find((item) => item.id === memberId);
  if (!member) {
    throw new Error("member not found");
  }
  const email = normalizeEmail(member.email);
  return {
    member: {
      id: member.id,
      name: member.name,
      email: member.email
    },
    licenses: store2.data.licenses.filter((license) => license.email === email).map((license) => licenseDashboardRow(store2, license)).sort((a, b) => b.generatedAt.localeCompare(a.generatedAt)),
    subscriptions: store2.data.subscriptions.filter((subscription) => subscription.memberId === member.id).map((subscription) => ({
      ...subscription,
      product: store2.data.products.find((product) => product.id === subscription.productId)
    }))
  };
}
function verifyVoucher(store2, input) {
  const product = findProductBySlug(store2, input.productSlug);
  const code = input.code.trim().toUpperCase();
  const now = /* @__PURE__ */ new Date();
  const voucher = store2.data.vouchers.find((item) => item.code === code && item.active && (item.productId === null || item.productId === product.id));
  if (!voucher) {
    return { valid: false, message: "Voucher tidak valid / kedaluwarsa." };
  }
  if (voucher.expiresAt && new Date(voucher.expiresAt) < now) {
    return { valid: false, message: "Voucher tidak valid / kedaluwarsa." };
  }
  if (voucher.maxUse !== null && voucher.usedCount >= voucher.maxUse) {
    return { valid: false, message: "Voucher tidak valid / kedaluwarsa." };
  }
  return { valid: true, voucher };
}
function publicPlansForProduct(store2, productSlug) {
  const product = findProductBySlug(store2, productSlug);
  return store2.data.plans.filter((plan) => plan.productId === product.id && plan.isActive).sort((a, b) => (a.sortOrder ?? 999) - (b.sortOrder ?? 999) || a.price - b.price).map((plan) => ({
    productSlug: product.slug,
    id: plan.code,
    code: plan.code,
    name: plan.name,
    price: plan.price,
    billingPeriod: plan.billingPeriod,
    durationDays: plan.durationDays,
    isFree: plan.isFree,
    badge: plan.badge,
    highlighted: plan.highlighted ?? false,
    sortOrder: plan.sortOrder
  }));
}
function productLicenseConfig(store2, productSlug) {
  const product = findProductBySlug(store2, productSlug);
  const announcement = store2.data.announcements.find((item) => item.productId === product.id && item.enabled);
  return {
    version: 1,
    product: product.slug,
    updatedAt: product.updatedAt,
    plans: publicPlansForProduct(store2, productSlug),
    announcement: announcement ?? null,
    supportUrl: process.env.TELEGRAM_SUPPORT_URL ?? ""
  };
}
function publicCatalog(store2) {
  const publicProducts = store2.data.products.filter((product) => product.visibility === "public" && product.active);
  return {
    featured: publicProducts.filter((product) => product.featured),
    paid: publicProducts.filter((product) => product.price > 0),
    free: publicProducts.filter((product) => product.price === 0 || product.type === "free")
  };
}
function markOrderPaid(store2, orderId, paidAt = /* @__PURE__ */ new Date()) {
  const order = store2.data.orders.find((item) => item.id === orderId);
  if (!order) {
    throw new Error("order not found");
  }
  const product = store2.data.products.find((item) => item.id === order.productId);
  if (!product) {
    throw new Error("product not found");
  }
  if (order.status === "paid") {
    const subscription2 = store2.data.subscriptions.find((item) => item.memberId === order.memberId && item.productId === order.productId);
    if (!subscription2) throw new Error("paid order subscription not found");
    return { order, subscription: subscription2 };
  }
  if (order.status !== "pending") {
    throw new Error(`order ${order.status} cannot be marked paid`);
  }
  order.status = "paid";
  order.paidAt = paidAt.toISOString();
  const subscription = createSubscription({
    memberId: order.memberId,
    productId: order.productId,
    billingPeriod: product.billingPeriod,
    paidAt
  });
  store2.data.subscriptions.push(subscription);
  store2.save();
  return { order, subscription };
}
function listPendingOrders(store2, limit = 10) {
  expirePendingOrders(store2);
  return store2.data.orders.filter((order) => order.status === "pending").sort((left, right) => right.createdAt.localeCompare(left.createdAt)).slice(0, limit).map((order) => {
    const product = store2.data.products.find((item) => item.id === order.productId);
    const member = store2.data.members.find((item) => item.id === order.memberId);
    return {
      id: order.id,
      invoiceNumber: order.invoiceNumber ?? order.id,
      productName: product?.name ?? order.productName ?? order.productId,
      productSlug: product?.slug ?? "",
      memberName: member?.name ?? "",
      memberEmail: member?.email ?? order.memberId,
      totalAmount: order.totalAmount ?? order.amount,
      formattedTotalAmount: formatCurrency(order.totalAmount ?? order.amount),
      createdAt: order.createdAt
    };
  });
}
function markOrderPaidByInvoice(store2, invoiceNumber, paidAt = /* @__PURE__ */ new Date()) {
  const order = store2.data.orders.find((item) => item.invoiceNumber === invoiceNumber || item.id === invoiceNumber);
  if (!order) {
    throw new Error("order not found");
  }
  if (order.status === "paid") {
    const subscription = store2.data.subscriptions.find((item) => item.memberId === order.memberId && item.productId === order.productId);
    if (subscription) return { order, subscription };
  }
  return markOrderPaid(store2, order.id, paidAt);
}
function generateLicenseForPaidOrder(store2, input) {
  const order = store2.data.orders.find((item) => item.invoiceNumber === input.invoiceNumber || item.id === input.invoiceNumber);
  if (!order) {
    throw new Error("order not found");
  }
  if (order.status !== "paid") {
    throw new Error("order belum paid");
  }
  const existing = store2.data.licenses.find((item) => item.orderId === order.id);
  if (existing) return existing;
  const product = store2.data.products.find((item) => item.id === order.productId);
  const member = store2.data.members.find((item) => item.id === order.memberId);
  if (!product) {
    throw new Error("product not found");
  }
  if (!member) {
    throw new Error("member not found");
  }
  const requestedPlanCode = input.planCode?.trim().toUpperCase();
  const activePlans = store2.data.plans.filter((plan) => plan.productId === product.id && plan.isActive).sort((left, right) => left.price - right.price);
  const matchingPlan = order.planId ? store2.data.plans.find((plan) => plan.id === order.planId && plan.productId === product.id) : requestedPlanCode ? activePlans.find((plan) => plan.code === requestedPlanCode) : activePlans.find((plan) => plan.price === order.amount) ?? activePlans[0];
  if (!matchingPlan) {
    throw new Error("plan not found");
  }
  const license = generateToolLicense(store2, {
    productSlug: product.slug,
    planCode: matchingPlan.code,
    email: member.email,
    hwid: input.hwid,
    now: input.now,
    salt: input.salt
  });
  license.orderId = order.id;
  store2.data.auditLogs.push({
    id: crypto3.randomUUID(),
    actorId: order.telegramId ?? order.memberId,
    action: "telegram.license.fulfilled",
    targetType: "license",
    targetId: license.id,
    createdAt: (input.now ?? /* @__PURE__ */ new Date()).toISOString()
  });
  store2.save();
  return license;
}
function generateDirectToolLicense(store2, input) {
  const product = findProductBySlug(store2, input.productSlug);
  findPlanByCode(store2, product.id, input.planCode);
  const now = input.now ?? /* @__PURE__ */ new Date();
  const email = normalizeEmail(input.email);
  const hwid = normalizeHwid(input.hwid);
  const linkedMember = store2.data.members.find((member) => member.active && member.email === email && member.telegramId);
  const existing = store2.data.licenses.find((license2) => license2.productId === product.id && license2.email === email && license2.hwid === hwid && ["generated", "active"].includes(license2.status) && (!license2.expiresAt || /* @__PURE__ */ new Date(`${license2.expiresAt}T23:59:59.999Z`) >= now));
  if (existing) return { license: existing, reused: true, buyerTelegramId: linkedMember?.telegramId };
  const license = generateToolLicense(store2, { ...input, email, hwid, now });
  return { license, reused: false, buyerTelegramId: linkedMember?.telegramId };
}
function formatInvoiceHtml(store2, orderIdOrInvoice, memberId) {
  const order = store2.data.orders.find((item) => item.id === orderIdOrInvoice || item.invoiceNumber === orderIdOrInvoice);
  if (!order || memberId && order.memberId !== memberId) {
    throw new Error("order not found");
  }
  const product = store2.data.products.find((item) => item.id === order.productId);
  const member = store2.data.members.find((item) => item.id === order.memberId);
  const invoiceNumber = order.invoiceNumber ?? order.id;
  const total = formatCurrency(order.totalAmount ?? order.amount);
  return `<!doctype html>
<html lang="id">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Invoice ${escapeHtml(invoiceNumber)}</title>
    <style>
      :root { --ink:#062c28; --muted:#60746f; --line:#d8e8e2; --soft:#f4fbf8; }
      * { box-sizing: border-box; }
      body { margin: 0; background: var(--soft); color: var(--ink); font-family: Arial, sans-serif; }
      main { max-width: 760px; margin: 24px auto; background: #fff; border: 1px solid var(--line); border-radius: 22px; padding: 24px; box-shadow: 0 18px 50px rgba(6,44,40,.08); }
      header { display: grid; grid-template-columns: minmax(0,1fr) auto; gap: 18px; align-items: start; border-bottom: 1px solid var(--line); padding-bottom: 16px; }
      h1 { margin: 4px 0 6px; font-size: 28px; line-height: 1; letter-spacing: -.04em; }
      h2 { margin: 0; font-size: 18px; }
      p { margin: 0; }
      .muted { color: var(--muted); }
      .brand { text-align: right; }
      .pill { display: inline-flex; border-radius: 999px; background: #e8f7f1; color: #007d74; font-size: 11px; font-weight: 800; letter-spacing: .1em; padding: 7px 10px; text-transform: uppercase; }
      .meta { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 8px; color: var(--muted); font-size: 12px; }
      .summary { display: grid; grid-template-columns: 1.15fr .85fr; gap: 16px; margin-top: 18px; align-items: start; }
      .grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; }
      .box { border: 1px solid var(--line); border-radius: 14px; padding: 11px 12px; min-height: 74px; }
      .box span, .total span { display: block; color: var(--muted); font-size: 10px; font-weight: 800; text-transform: uppercase; letter-spacing: .12em; }
      .box b { display: block; margin-top: 5px; font-size: 16px; line-height: 1.15; }
      .box p { margin-top: 6px; color: var(--muted); font-size: 13px; }
      .payment { display: grid; gap: 10px; }
      .total { background: var(--ink); color: #fff; border-radius: 16px; padding: 14px; }
      .total span { color: #b8ddd2; }
      .total b { display: block; margin-top: 4px; font-size: 25px; letter-spacing: -.03em; }
      .qris { border: 1px solid var(--line); border-radius: 18px; padding: 10px; background: #fff; }
      img { width: 100%; max-width: 230px; display: block; margin: 0 auto; border-radius: 14px; }
      .note { margin-top: 16px; border: 1px dashed #b7d8cf; border-radius: 14px; padding: 12px; color: var(--muted); font-size: 13px; line-height: 1.45; background: #fbfffd; }
      button { border: 0; border-radius: 999px; background: var(--ink); color: #fff; padding: 10px 16px; font-weight: 800; cursor: pointer; }
      .no-print { margin-top: 14px; }
      @media print { body { background: #fff; } main { margin: 0; border: 0; box-shadow: none; } .no-print { display: none; } }
      @media (max-width: 640px) { main { margin: 10px; padding: 16px; } header, .summary, .grid { grid-template-columns: 1fr; } .brand { text-align: left; } h1 { font-size: 24px; } }
    </style>
  </head>
  <body>
    <main>
      <header>
        <div>
          <span class="pill">Invoice QRIS</span>
          <h1>${escapeHtml(invoiceNumber)}</h1>
          <div class="meta">
            <span>${escapeHtml(new Date(order.createdAt).toLocaleString("id-ID"))}</span>
            <span>Status: ${escapeHtml(order.status)}</span>
            <span>Batas: ${escapeHtml(order.expiresAt ? new Date(order.expiresAt).toLocaleString("id-ID") : "24 jam")}</span>
          </div>
        </div>
        <div class="brand">
          <h2>AsistenQ</h2>
          <p class="muted">Tools Bantu nge-YouTube</p>
        </div>
      </header>
      <section class="summary">
        <div class="grid">
          <div class="box"><span>Member</span><b>${escapeHtml(member?.name ?? "-")}</b><p>${escapeHtml(member?.email ?? order.memberId)}</p></div>
          <div class="box"><span>Produk</span><b>${escapeHtml(product?.name ?? order.productName ?? order.productId)}</b><p>${escapeHtml(product?.slug ?? "")}</p></div>
          <div class="box"><span>Harga</span><b>${escapeHtml(formatCurrency(order.amount))}</b></div>
          <div class="box"><span>Kode Unik</span><b>${escapeHtml(order.uniqueCode ?? 0)}</b></div>
        </div>
        <aside class="payment">
          <div class="total"><span>Total Bayar</span><b>${escapeHtml(total)}</b></div>
          ${order.paymentQrUrl ? `<div class="qris"><img src="${escapeHtml(order.paymentQrUrl)}" alt="QRIS pembayaran" /></div>` : ""}
        </aside>
      </section>
      <p class="note">Bayar sesuai total termasuk kode unik. Setelah transfer, kirim bukti pembayaran via Telegram. Lisensi akan muncul di akun member setelah admin memproses pembayaran.</p>
      <p class="no-print"><button onclick="window.print()">Print / Save PDF</button></p>
    </main>
  </body>
</html>`;
}
async function updateMemberAccount(store2, memberId, input) {
  const member = store2.data.members.find((m) => m.id === memberId);
  if (!member) throw new Error("Member tidak ditemukan.");
  if (input.name !== void 0) member.name = input.name;
  if (input.whatsapp !== void 0) member.whatsapp = input.whatsapp.trim();
  if (input.telegramId !== void 0) member.telegramId = input.telegramId.trim();
  if (input.avatarUrl !== void 0) member.avatarUrl = input.avatarUrl;
  if (input.active !== void 0) member.active = input.active;
  if (input.password) {
    const bcrypt3 = __require("bcryptjs");
    member.passwordHash = await bcrypt3.hash(input.password, 12);
  }
  store2.save();
  return member;
}
async function updateOwnMemberProfile(store2, memberId, input) {
  const member = store2.data.members.find((item) => item.id === memberId);
  if (!member) throw new Error("Member tidak ditemukan.");
  if (input.newPassword) {
    if (!input.currentPassword || !await bcrypt.compare(input.currentPassword, member.passwordHash)) {
      throw new Error("Password saat ini salah.");
    }
    member.passwordHash = await bcrypt.hash(input.newPassword, 12);
  }
  if (input.name !== void 0) member.name = input.name.trim();
  if (input.whatsapp !== void 0) member.whatsapp = input.whatsapp.trim();
  if (input.telegramId !== void 0) member.telegramId = input.telegramId.trim();
  store2.save();
  return member;
}

// src/server/seed.ts
import bcrypt2 from "bcryptjs";

// src/server/site-content.ts
import crypto4 from "crypto";
var initialPages = [
  { slug: "cara-pembelian", title: "Cara Pembelian", summary: "Panduan membeli produk digital di AsistenQ.", body: "Pilih produk dan paket, masukkan ke keranjang, login sebagai member, lalu bayar tepat sesuai nominal QRIS pada invoice. Setelah pembayaran diverifikasi, akses produk tersedia di akun member.", published: true },
  { slug: "cara-aktivasi", title: "Cara Aktivasi & Pengiriman", summary: "Cara menerima dan mengaktifkan produk.", body: "Lisensi, file, tautan akses, atau kelas dikirim ke akun member sesuai jenis produk. Untuk aplikasi berlisensi, ikuti petunjuk HWID dan masukkan token aktivasi yang diterima.", published: true },
  { slug: "kebijakan-refund", title: "Kebijakan Refund", summary: "Ketentuan pengembalian dana produk digital.", body: "Permohonan refund dapat diajukan maksimal 7 hari apabila produk tidak dapat digunakan karena masalah yang dapat diverifikasi dan tim bantuan tidak berhasil menyelesaikannya. Produk yang sudah diunduh, lisensi yang sudah aktif, atau layanan yang telah digunakan dapat dikecualikan.", published: true },
  { slug: "syarat-ketentuan", title: "Syarat & Ketentuan", summary: "Ketentuan penggunaan marketplace AsistenQ.", body: "Dengan membeli atau menggunakan produk AsistenQ, pengguna menyetujui penggunaan yang sah, menjaga keamanan akun, dan tidak membagikan lisensi atau file tanpa izin. Detail produk dan masa akses mengikuti informasi pada halaman pembelian.", published: true },
  { slug: "kebijakan-privasi", title: "Kebijakan Privasi", summary: "Cara AsistenQ memproses data pengguna.", body: "AsistenQ menggunakan data akun dan transaksi untuk menyediakan layanan, memproses pembayaran, dukungan, serta keamanan. Data tidak dijual dan hanya dibagikan kepada penyedia layanan yang diperlukan untuk operasional.", published: true },
  { slug: "faq", title: "Pertanyaan Umum", summary: "Jawaban singkat mengenai pembelian dan akses.", body: "Pembayaran menggunakan QRIS dengan nominal unik. Verifikasi dilakukan admin. Seluruh produk yang berhasil diproses dapat dilihat melalui akun member.", published: true },
  { slug: "tentang-asistenq", title: "Tentang AsistenQ", summary: "Marketplace tools bantu creator.", body: "AsistenQ menyediakan aplikasi, file digital, web tools, dan kelas untuk membantu creator bekerja lebih cepat, produktif, dan konsisten.", published: true },
  { slug: "kontak", title: "Kontak & Bantuan", summary: "Hubungi tim AsistenQ.", body: "Email: cs@ziqva.com\nTelegram: @effands\n\nHubungi kami untuk bantuan pembelian, aktivasi, dan penggunaan produk.", published: true }
];
function seedSiteContent(store2, now = /* @__PURE__ */ new Date()) {
  let changed = false;
  for (const page of initialPages) if (!store2.data.contentPages.some((row) => row.slug === page.slug)) {
    store2.data.contentPages.push({ ...page, id: crypto4.randomUUID(), updatedAt: now.toISOString() });
    changed = true;
  }
  if (changed) store2.save();
}
function publishedContent(store2, slug) {
  const page = store2.data.contentPages.find((row) => row.slug === slug && row.published);
  if (!page) throw new Error("halaman tidak ditemukan");
  return page;
}
function updateContentPage(store2, id, patch, now = /* @__PURE__ */ new Date()) {
  const page = store2.data.contentPages.find((row) => row.id === id);
  if (!page) throw new Error("halaman tidak ditemukan");
  Object.assign(page, patch, { updatedAt: now.toISOString() });
  store2.save();
  return page;
}

// src/server/seed.ts
function ensureProduct(store2, input) {
  const existingProduct = store2.data.products.find((product) => product.slug === input.slug);
  if (existingProduct) {
    return existingProduct;
  }
  return createProductRecord(store2, input);
}
function syncLegacyMixin9Plans(store2, product) {
  const productPlans = store2.data.plans.filter((plan) => plan.productId === product.id);
  const hasLegacyFreePlan = productPlans.some((plan) => plan.code === "DEFAULT" && plan.price === 0);
  const hasExpectedPlans = ["1M", "6M", "1Y"].every((code) => productPlans.some((plan) => plan.code === code));
  if (product.price !== 0 && !hasLegacyFreePlan && hasExpectedPlans) return;
  Object.assign(product, {
    accessMode: "paid",
    billingPeriod: "monthly",
    price: 35e3,
    compareAtPrice: 199e3,
    discountLabel: "Paket Fleksibel",
    promoText: "Batch mixing audio cepat untuk creator. Pilih paket 1 bulan, 6 bulan, atau 1 tahun.",
    landingTemplate: "mixin9",
    ctaLabel: "Beli MIXIN9 Sekarang",
    accessRequirement: "Selesaikan pembayaran QRIS untuk membuka lisensi MIXIN9.",
    fulfillmentType: "license",
    updatedAt: (/* @__PURE__ */ new Date()).toISOString()
  });
  store2.data.plans = store2.data.plans.filter((plan) => !(plan.productId === product.id && plan.code === "DEFAULT"));
  [
    { code: "1M", name: "Lisensi 1 Bulan", price: 35e3, billingPeriod: "monthly", durationDays: 30, isFree: false, isActive: true, sortOrder: 10 },
    { code: "6M", name: "Lisensi 6 Bulan", price: 99e3, billingPeriod: "monthly", durationDays: 180, isFree: false, isActive: true, highlighted: true, sortOrder: 20 },
    { code: "1Y", name: "Lisensi 1 Tahun", price: 155e3, billingPeriod: "annual", durationDays: 365, isFree: false, isActive: true, sortOrder: 30 }
  ].forEach((plan) => {
    const record = createPlanRecord(store2, { productId: product.id, ...plan });
    if (record.price === 0 || record.code === plan.code) Object.assign(record, plan);
  });
  store2.save();
}
async function seedInitialData(store2) {
  seedSiteContent(store2);
  const retiredProductIds = new Set(
    store2.data.products.filter((product) => product.slug === "jadwalinaja").map((product) => product.id)
  );
  if (retiredProductIds.size > 0) {
    store2.data.products = store2.data.products.filter((product) => !retiredProductIds.has(product.id));
    store2.data.plans = store2.data.plans.filter((item) => !retiredProductIds.has(item.productId));
    store2.data.orders = store2.data.orders.filter((item) => !retiredProductIds.has(item.productId));
    store2.data.subscriptions = store2.data.subscriptions.filter((item) => !retiredProductIds.has(item.productId));
    store2.data.licenses = store2.data.licenses.filter((item) => !retiredProductIds.has(item.productId));
    store2.data.vouchers = store2.data.vouchers.filter(
      (item) => item.productId === null || !retiredProductIds.has(item.productId)
    );
    store2.data.announcements = store2.data.announcements.filter(
      (item) => item.productId === null || !retiredProductIds.has(item.productId)
    );
    store2.data.bannedHwids = store2.data.bannedHwids.filter((item) => !retiredProductIds.has(item.productId));
    store2.data.toolAnalyticsEvents = store2.data.toolAnalyticsEvents.filter((item) => !retiredProductIds.has(item.productId));
    store2.data.auditLogs = store2.data.auditLogs.filter((item) => !retiredProductIds.has(item.targetId));
  }
  if (!store2.data.admins.some((admin) => admin.role === "super_admin")) {
    store2.data.admins.push({
      id: "admin_super",
      name: "Super Admin",
      email: process.env.ADMIN_EMAIL ?? "effands@gmail.com",
      passwordHash: await bcrypt2.hash(process.env.ADMIN_PASSWORD ?? "aszxaszx", 12),
      role: "super_admin",
      scopes: [],
      active: true,
      createdAt: (/* @__PURE__ */ new Date()).toISOString()
    });
  }
  const vjStudio = ensureProduct(store2, {
    name: "VJ Studio Pro",
    slug: "vjstudio",
    type: "tool",
    category: "Video Editing",
    visibility: "public",
    billingPeriod: "monthly",
    price: 49900,
    featured: true,
    headline: "Lisensi resmi untuk workflow video YouTube yang lebih cepat.",
    description: "VJ Studio Pro membantu creator mengelola workflow produksi dan editing video dengan aktivasi lisensi per perangkat.",
    coverUrl: "https://images.unsplash.com/photo-1574717024653-61fd2cf4d44d?auto=format&fit=crop&w=800&q=80",
    accessUrl: "/member/licenses"
  });
  vjStudio.downloadSourceUrl = "https://drive.google.com/drive/folders/1MeZbmNSC0HoIFsYaOKmCZ1AWG-751Jsm?usp=sharing";
  vjStudio.cardDescription ??= "Aplikasi workflow video YouTube lengkap dan ringan untuk creator.";
  vjStudio.marketplaceAccent ??= "#056128";
  vjStudio.tags ??= ["Windows", "Video Creator", "Lisensi"];
  vjStudio.badge ??= "PRO";
  vjStudio.fulfillmentType ??= "license";
  vjStudio.benefits ??= [
    { title: "Workflow Otomatis", description: "Membantu proses produksi video lebih cepat dan konsisten." },
    { title: "Ringan & Cepat", description: "Dirancang untuk workflow creator pada perangkat Windows." },
    { title: "Update Berkala", description: "Pembaruan fitur dan perbaikan tersedia selama lisensi aktif." }
  ];
  vjStudio.features ??= vjStudio.benefits;
  vjStudio.targetUsers ??= ["YouTuber", "Content Creator", "Digital Agency", "Freelancer"];
  vjStudio.developer ??= "AsistenQ Team";
  vjStudio.compatibility ??= "Windows 10/11 (64-bit)";
  vjStudio.language ??= "Indonesia";
  vjStudio.sku ??= "AQ-VJSP-PRO";
  [
    { code: "TRIAL", name: "Trial 1 Hari", price: 0, billingPeriod: "trial", durationDays: 1, isFree: true, isActive: false },
    { code: "1M", name: "Lisensi 1 Bulan", price: 49900, billingPeriod: "monthly", durationDays: 30, isFree: false, isActive: true, sortOrder: 10 },
    { code: "2M", name: "Lisensi 2 Bulan", price: 85900, billingPeriod: "monthly", durationDays: 60, isFree: false, isActive: false },
    { code: "3M", name: "Lisensi 3 Bulan", price: 129900, billingPeriod: "monthly", durationDays: 90, isFree: false, isActive: true, sortOrder: 20 },
    { code: "6M", name: "Lisensi 6 Bulan", price: 225900, billingPeriod: "monthly", durationDays: 180, isFree: false, isActive: true, sortOrder: 30, badge: "Best Seller", highlighted: true },
    { code: "1Y", name: "Lisensi 1 Tahun", price: 399e3, billingPeriod: "annual", durationDays: 365, isFree: false, isActive: true, sortOrder: 40 },
    { code: "LIFETIME", name: "Lisensi Lifetime", price: 799e3, billingPeriod: "lifetime", durationDays: null, isFree: false, isActive: false }
  ].forEach((plan) => {
    const record = createPlanRecord(store2, {
      productId: vjStudio.id,
      ...plan
    });
    if (!plan.isActive) record.isActive = false;
    if (plan.isActive && record.sortOrder === void 0) record.sortOrder = plan.sortOrder;
    if (plan.code === "6M") {
      if (record.badge === void 0) record.badge = "Best Seller";
      if (record.highlighted === void 0) record.highlighted = true;
    }
  });
  ensureProduct(store2, {
    name: "Kelas YouTube Online",
    slug: "kelas-youtube-online",
    type: "course",
    category: "E-Learning",
    visibility: "public",
    billingPeriod: "annual",
    price: 799e3,
    featured: true,
    headline: "Kelas tahunan untuk membangun channel YouTube dengan workflow yang rapi.",
    description: "Akses video tutorial, materi pendukung, dan update kelas untuk produksi konten YouTube.",
    coverUrl: "https://images.unsplash.com/photo-1611162617474-5b21e879e113?auto=format&fit=crop&w=800&q=80",
    accessUrl: "/member/courses/kelas-youtube"
  });
  const mixin9 = ensureProduct(store2, {
    name: "MIXIN9",
    slug: "mixin9",
    type: "tool",
    category: "Audio Tools",
    visibility: "public",
    accessMode: "paid",
    billingPeriod: "monthly",
    price: 35e3,
    compareAtPrice: 199e3,
    discountLabel: "Paket Fleksibel",
    promoText: "Batch mixing audio cepat untuk creator. Pilih paket 1 bulan, 6 bulan, atau 1 tahun.",
    logoUrl: "",
    landingPath: "/mixin9",
    landingTemplate: "mixin9",
    ctaLabel: "Beli MIXIN9 Sekarang",
    accessRequirement: "Selesaikan pembayaran QRIS untuk membuka lisensi MIXIN9.",
    fulfillmentType: "license",
    featured: true,
    headline: "Batch mixing audio banyak file dalam satu alur cepat.",
    description: "MIXIN9 membantu creator merapikan loudness, balance, dan proses mixing audio secara batch tanpa membuka file satu per satu.",
    coverUrl: "",
    accessUrl: "/landing-imports/mixin9/index.html",
    plans: [
      {
        code: "1M",
        name: "Lisensi 1 Bulan",
        price: 35e3,
        billingPeriod: "monthly",
        durationDays: 30,
        isFree: false,
        isActive: true,
        sortOrder: 10
      },
      {
        code: "6M",
        name: "Lisensi 6 Bulan",
        price: 99e3,
        billingPeriod: "monthly",
        durationDays: 180,
        isFree: false,
        isActive: true,
        highlighted: true,
        sortOrder: 20
      },
      {
        code: "1Y",
        name: "Lisensi 1 Tahun",
        price: 155e3,
        billingPeriod: "annual",
        durationDays: 365,
        isFree: false,
        isActive: true,
        sortOrder: 30
      }
    ]
  });
  syncLegacyMixin9Plans(store2, mixin9);
  ensureProduct(store2, {
    name: "YouTube Starter Kit",
    slug: "youtube-starter-kit",
    type: "free",
    category: "Resource",
    visibility: "public",
    billingPeriod: "one_time",
    price: 0,
    featured: false,
    headline: "Resource gratis untuk memulai workflow konten YouTube.",
    description: "Template dan checklist dasar yang bisa dipakai sebelum membeli tools atau kelas premium.",
    coverUrl: "",
    accessUrl: "/member/resources"
  });
  if (!store2.data.products.some((product) => product.slug === "youtube-cutter")) {
    ensureProduct(store2, {
      name: "AsistenQ YouTube Cutter",
      slug: "youtube-cutter",
      type: "tool",
      category: "Video Editing",
      visibility: "private",
      billingPeriod: "monthly",
      price: 99e3,
      featured: false,
      headline: "Rapikan workflow editing YouTube lebih cepat.",
      description: "Tools awal untuk membantu creator memangkas proses kerja video harian.",
      coverUrl: "",
      accessUrl: "/member/licenses"
    });
  }
  if (!store2.data.products.some((product) => product.slug === "kelas-creator")) {
    ensureProduct(store2, {
      name: "Kelas AsistenQ Creator",
      slug: "kelas-creator",
      type: "class",
      category: "E-Learning",
      visibility: "private",
      billingPeriod: "annual",
      price: 799e3,
      featured: false,
      headline: "Akses tahunan ke kelas video dan materi creator.",
      description: "Materi premium untuk editing, produksi konten, dan workflow YouTube.",
      coverUrl: "",
      accessUrl: "/member/licenses"
    });
  }
  for (const product of store2.data.products.filter((row) => row.active && row.visibility === "public")) {
    if (!store2.data.plans.some((plan) => plan.productId === product.id)) {
      createPlanRecord(store2, { productId: product.id, code: "DEFAULT", name: product.price === 0 ? "Akses Gratis" : "Paket Produk", price: product.price, billingPeriod: product.billingPeriod, durationDays: product.billingPeriod === "annual" ? 365 : product.billingPeriod === "monthly" ? 30 : null, isFree: product.price === 0, isActive: true, sortOrder: 10 });
    }
  }
  store2.save();
}

// src/server/store.ts
import fs3 from "fs";
import path3 from "path";
var defaultQrisStaticPayload = "00020101021126570011ID.DANA.WWW011893600915303265462802090326546280303UMI51440014ID.CO.QRIS.WWW0215ID10265329452210303UMI5204504553033605802ID5905ZIQVA6011Kab. Malang6105651676304F3F6";
var emptyData = () => ({
  admins: [],
  members: [],
  passwordResets: [],
  products: [],
  plans: [],
  licenses: [],
  vouchers: [],
  announcements: [],
  bannedHwids: [],
  orders: [],
  downloadGrants: [],
  subscriptions: [],
  auditLogs: [],
  toolAnalyticsEvents: [],
  accessGrants: [],
  contentPages: [],
  subscribers: [],
  deploymentSettings: {
    githubRepo: "effands/asistenq",
    githubBranch: "master",
    qrisStaticPayload: defaultQrisStaticPayload
  }
});
function normalizeData(data) {
  return {
    ...emptyData(),
    ...data,
    admins: data.admins ?? [],
    members: data.members ?? [],
    passwordResets: data.passwordResets ?? [],
    products: data.products ?? [],
    plans: data.plans ?? [],
    licenses: data.licenses ?? [],
    vouchers: data.vouchers ?? [],
    announcements: data.announcements ?? [],
    bannedHwids: data.bannedHwids ?? [],
    orders: data.orders ?? [],
    downloadGrants: data.downloadGrants ?? [],
    subscriptions: data.subscriptions ?? [],
    auditLogs: data.auditLogs ?? [],
    toolAnalyticsEvents: data.toolAnalyticsEvents ?? [],
    accessGrants: data.accessGrants ?? [],
    contentPages: data.contentPages ?? [],
    subscribers: data.subscribers ?? [],
    deploymentSettings: {
      githubRepo: "effands/asistenq",
      githubBranch: "master",
      qrisStaticPayload: defaultQrisStaticPayload,
      ...data.deploymentSettings ?? {}
    }
  };
}
function createMemoryStore(initialData = emptyData()) {
  return {
    data: structuredClone(normalizeData(initialData)),
    save() {
    },
    reset() {
      this.data = emptyData();
    }
  };
}
function createFileStore(filePath = path3.resolve("data/asistenq.json")) {
  const dir = path3.dirname(filePath);
  if (!fs3.existsSync(dir)) {
    fs3.mkdirSync(dir, { recursive: true });
  }
  if (!fs3.existsSync(filePath)) {
    fs3.writeFileSync(filePath, JSON.stringify(emptyData(), null, 2));
  }
  return {
    data: normalizeData(JSON.parse(fs3.readFileSync(filePath, "utf-8"))),
    save() {
      fs3.writeFileSync(filePath, JSON.stringify(this.data, null, 2));
    },
    reset() {
      this.data = emptyData();
      this.save();
    }
  };
}

// src/server/mailer.ts
import net from "net";
import tls from "tls";
import fs4 from "fs";
import path4 from "path";
function readMailSettings() {
  try {
    const filePath = path4.resolve("data/mail-settings.json");
    return JSON.parse(fs4.readFileSync(filePath, "utf-8"));
  } catch {
    return {};
  }
}
function readDeploymentMailSettings() {
  try {
    const filePath = path4.resolve("data/asistenq.json");
    const data = JSON.parse(fs4.readFileSync(filePath, "utf-8"));
    return data.deploymentSettings ?? {};
  } catch {
    return {};
  }
}
function resolveMailSettings(env, file, admin) {
  return {
    SMTP_HOST: env.SMTP_HOST || admin.smtpHost || file.SMTP_HOST,
    SMTP_PORT: env.SMTP_PORT || admin.smtpPort || file.SMTP_PORT,
    SMTP_USER: env.SMTP_USER || admin.smtpUser || file.SMTP_USER,
    SMTP_PASS: env.SMTP_PASS || admin.smtpPass || file.SMTP_PASS,
    MAIL_FROM: env.MAIL_FROM || admin.mailFrom || file.MAIL_FROM
  };
}
function settings() {
  const file = readMailSettings();
  return resolveMailSettings(process.env, file, readDeploymentMailSettings());
}
function configured(mailSettings) {
  return Boolean(mailSettings.SMTP_HOST && mailSettings.SMTP_USER && mailSettings.SMTP_PASS && mailSettings.MAIL_FROM);
}
function readLine(socket) {
  return new Promise((resolve, reject) => {
    let buffer = "";
    const onData = (chunk) => {
      buffer += chunk.toString("utf8");
      if (buffer.includes("\n")) {
        socket.off("data", onData);
        resolve(buffer);
      }
    };
    socket.once("error", reject);
    socket.on("data", onData);
  });
}
async function command(socket, text) {
  socket.write(`${text}\r
`);
  return readLine(socket);
}
function message(input) {
  const from = settings().MAIL_FROM ?? "";
  const boundary = `asistenq-${Date.now()}`;
  const text = input.text ?? input.html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
  return [
    `From: ${from}`,
    `To: ${input.to}`,
    `Subject: ${input.subject}`,
    "MIME-Version: 1.0",
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
    "",
    `--${boundary}`,
    "Content-Type: text/plain; charset=utf-8",
    "",
    text,
    `--${boundary}`,
    "Content-Type: text/html; charset=utf-8",
    "",
    input.html,
    `--${boundary}--`,
    "."
  ].join("\r\n");
}
function senderAddress(from) {
  const match = from.match(/<([^>]+)>/);
  return (match?.[1] ?? from).trim();
}
async function sendMail(input) {
  const mailSettings = settings();
  if (!configured(mailSettings)) {
    return { sent: false, reason: "SMTP belum disetting." };
  }
  const host = mailSettings.SMTP_HOST ?? "";
  const port2 = Number(mailSettings.SMTP_PORT ?? 587);
  const from = mailSettings.MAIL_FROM ?? "";
  const envelopeFrom = senderAddress(from);
  const secure = port2 === 465;
  const socket = secure ? tls.connect({ host, port: port2, servername: host }) : net.connect({ host, port: port2 });
  try {
    await readLine(socket);
    await command(socket, `EHLO asistenq.com`);
    if (!secure) {
      await command(socket, "STARTTLS");
      const upgraded = tls.connect({ socket, servername: host });
      await command(upgraded, `EHLO asistenq.com`);
      await command(upgraded, "AUTH LOGIN");
      await command(upgraded, Buffer.from(mailSettings.SMTP_USER ?? "").toString("base64"));
      await command(upgraded, Buffer.from(mailSettings.SMTP_PASS ?? "").toString("base64"));
      await command(upgraded, `MAIL FROM:<${envelopeFrom}>`);
      await command(upgraded, `RCPT TO:<${input.to}>`);
      await command(upgraded, "DATA");
      await command(upgraded, message(input));
      await command(upgraded, "QUIT");
      return { sent: true };
    }
    await command(socket, "AUTH LOGIN");
    await command(socket, Buffer.from(mailSettings.SMTP_USER ?? "").toString("base64"));
    await command(socket, Buffer.from(mailSettings.SMTP_PASS ?? "").toString("base64"));
    await command(socket, `MAIL FROM:<${envelopeFrom}>`);
    await command(socket, `RCPT TO:<${input.to}>`);
    await command(socket, "DATA");
    await command(socket, message(input));
    await command(socket, "QUIT");
    return { sent: true };
  } catch (error) {
    return { sent: false, reason: error instanceof Error ? error.message : "Email gagal dikirim." };
  } finally {
    socket.destroy();
  }
}

// src/server/analytics.ts
var liveWindowMs = 6e4;
var presence = /* @__PURE__ */ new Map();
function presenceKey(visitorId, instanceId) {
  return `${visitorId}:${instanceId}`;
}
function prunePresence(now) {
  const oldestAllowed = now.getTime() - liveWindowMs;
  for (const [key, entry] of presence) {
    if (entry.lastSeenAt < oldestAllowed) presence.delete(key);
  }
}
function heartbeatPresence(input) {
  const now = input.now ?? /* @__PURE__ */ new Date();
  presence.set(presenceKey(input.visitorId, input.instanceId), {
    visitorId: input.visitorId,
    instanceId: input.instanceId,
    productId: input.productId,
    lastSeenAt: now.getTime()
  });
  prunePresence(now);
}
function recordAnalyticsEvent(store2, input) {
  store2.data.toolAnalyticsEvents.push({
    id: createId("event"),
    productId: input.productId,
    visitorId: input.visitorId,
    eventType: input.eventType,
    createdAt: (input.now ?? /* @__PURE__ */ new Date()).toISOString()
  });
  store2.save();
}
function analyticsOverview(store2, now = /* @__PURE__ */ new Date()) {
  prunePresence(now);
  const onlineVisitors = new Set(Array.from(presence.values()).map((entry) => entry.visitorId));
  const products = store2.data.products.map((product) => {
    const events = store2.data.toolAnalyticsEvents.filter((event) => event.productId === product.id);
    const productOnline = product.trackLiveUsers !== false && product.destinationType !== "external" ? new Set(Array.from(presence.values()).filter((entry) => entry.productId === product.id).map((entry) => entry.visitorId)).size : 0;
    return {
      productId: product.id,
      slug: product.slug,
      name: product.name,
      destinationType: product.destinationType ?? "internal",
      onlineUsers: productOnline,
      detailViews: events.filter((event) => event.eventType === "detail_view").length,
      toolOpens: events.filter((event) => event.eventType === "tool_open").length,
      checkoutClicks: events.filter((event) => event.eventType === "checkout_click").length
    };
  });
  return {
    onlineUsers: onlineVisitors.size,
    totalDetailViews: products.reduce((total, product) => total + product.detailViews, 0),
    totalToolOpens: products.reduce((total, product) => total + product.toolOpens, 0),
    products
  };
}

// src/server/telegram-commerce.ts
import crypto5 from "crypto";
import fs5 from "fs";
import path5 from "path";
function validatedDownloadSource(type, source) {
  if (type !== "download" || !source?.trim()) return void 0;
  const value = source.trim();
  const parsed = new URL(value);
  if (parsed.protocol !== "https:") throw new Error("URL download harus HTTPS.");
  return value;
}
function createTelegramProduct(store2, input, actorTelegramId = "system") {
  const downloadSourceUrl = validatedDownloadSource(input.fulfillmentType, input.downloadSourceUrl);
  const product = createProductRecord(store2, {
    name: input.name.trim(),
    slug: input.slug.trim(),
    type: "tool",
    visibility: input.status,
    accessMode: "paid",
    billingPeriod: "one_time",
    price: input.plan.price,
    active: input.status !== "draft",
    description: input.description.trim(),
    fulfillmentType: input.fulfillmentType,
    downloadSourceUrl
  });
  const plan = createPlanRecord(store2, {
    productId: product.id,
    code: input.plan.code,
    name: input.plan.name,
    price: input.plan.price,
    billingPeriod: input.plan.durationDays === null ? "lifetime" : "monthly",
    durationDays: input.plan.durationDays,
    isActive: true
  });
  audit(store2, actorTelegramId, "telegram.product.created", "product", product.id, /* @__PURE__ */ new Date());
  store2.save();
  return { product, plan };
}
function updateTelegramProduct(store2, productId, input, actorTelegramId = "system") {
  const product = store2.data.products.find((item) => item.id === productId);
  if (!product) throw new Error("product not found");
  const fulfillmentType = input.fulfillmentType ?? product.fulfillmentType ?? (product.downloadSourceUrl ? "download" : "license");
  const downloadSourceUrl = input.downloadSourceUrl === void 0 ? product.downloadSourceUrl : validatedDownloadSource(fulfillmentType, input.downloadSourceUrl);
  const patch = { fulfillmentType };
  if (input.name !== void 0) patch.name = input.name.trim();
  if (input.slug !== void 0) patch.slug = input.slug.trim();
  if (input.description !== void 0) patch.description = input.description.trim();
  if (input.status !== void 0) {
    patch.visibility = input.status;
    patch.active = input.status !== "draft";
  }
  if (fulfillmentType === "download" && downloadSourceUrl !== void 0) patch.downloadSourceUrl = downloadSourceUrl;
  if (fulfillmentType === "license") patch.downloadSourceUrl = "";
  const updated = updateProductRecord(store2, productId, patch);
  audit(store2, actorTelegramId, "telegram.product.updated", "product", productId, /* @__PURE__ */ new Date());
  store2.save();
  return updated;
}
function updateTelegramPlan(store2, planId, input, actorTelegramId = "system") {
  const updated = updatePlanRecord(store2, planId, input);
  audit(store2, actorTelegramId, "telegram.plan.updated", "plan", planId, /* @__PURE__ */ new Date());
  store2.save();
  return updated;
}
function deactivateTelegramProduct(store2, productId, actorTelegramId = "system") {
  const updated = updateProductRecord(store2, productId, { active: false, visibility: "draft" });
  audit(store2, actorTelegramId, "telegram.product.deactivated", "product", productId, /* @__PURE__ */ new Date());
  store2.save();
  return updated;
}
function attachTelegramDigitalFile(store2, productId, filePath, actorTelegramId = "system") {
  const product = store2.data.products.find((item) => item.id === productId);
  if (!product || product.fulfillmentType !== "download") throw new Error("produk bukan produk download");
  const privateRoot = path5.resolve("data/digital-products");
  const absolutePath = path5.resolve(filePath);
  if (path5.dirname(absolutePath) !== privateRoot || path5.extname(absolutePath).toLowerCase() !== ".zip") throw new Error("path file digital tidak valid");
  const signature = fs5.readFileSync(absolutePath).subarray(0, 4);
  const zipSignature = signature.length === 4 && signature[0] === 80 && signature[1] === 75 && (signature[2] === 3 && signature[3] === 4 || signature[2] === 5 && signature[3] === 6 || signature[2] === 7 && signature[3] === 8);
  if (!zipSignature) throw new Error("file bukan ZIP yang valid");
  const updated = updateProductRecord(store2, productId, { downloadSourceUrl: absolutePath });
  audit(store2, actorTelegramId, "telegram.product.file_attached", "product", productId, /* @__PURE__ */ new Date());
  store2.save();
  return updated;
}
function audit(store2, actorId, action, targetType, targetId, now) {
  store2.data.auditLogs.push({ id: crypto5.randomUUID(), actorId, action, targetType, targetId, createdAt: now.toISOString() });
}
function assertConfiguredOwner(store2, telegramId) {
  const configured2 = store2.data.deploymentSettings?.telegramOwnerId;
  if (configured2 && configured2 !== telegramId) throw new Error("owner access required");
}
async function registerTelegramBuyer(store2, input) {
  const telegramId = input.telegramId.trim();
  const email = input.email.trim().toLowerCase();
  const byTelegram = store2.data.members.find((item) => item.telegramId === telegramId);
  if (byTelegram) {
    return byTelegram;
  }
  const byEmail = store2.data.members.find((item) => item.email === email);
  if (byEmail) {
    throw new Error(byEmail.telegramId ? "email sudah terhubung ke akun Telegram lain" : "email sudah terdaftar; hubungkan Telegram melalui dashboard");
  }
  return createMember(store2, {
    ...input,
    telegramId,
    password: crypto5.randomBytes(24).toString("base64url")
  });
}
function listTelegramCatalog(store2) {
  return store2.data.products.filter((product) => product.active && product.visibility !== "draft").map((product) => ({
    id: product.id,
    name: product.name,
    slug: product.slug,
    type: product.type,
    category: product.category,
    fulfillmentType: product.fulfillmentType,
    headline: product.headline,
    description: product.description,
    coverUrl: product.coverUrl,
    logoUrl: product.logoUrl,
    plans: store2.data.plans.filter((plan) => plan.productId === product.id && plan.isActive).map((plan) => ({
      id: plan.id,
      productId: plan.productId,
      code: plan.code,
      name: plan.name,
      price: plan.price,
      billingPeriod: plan.billingPeriod,
      durationDays: plan.durationDays,
      isFree: plan.isFree,
      formattedPrice: formatCurrency(plan.price)
    }))
  })).filter((product) => product.plans.length > 0);
}
var telegramInvoiceLifetimeMinutes = 30;
async function createTelegramCheckout(store2, input, now = /* @__PURE__ */ new Date()) {
  expirePendingOrders(store2, now);
  const member = store2.data.members.find((item) => item.telegramId === input.telegramId);
  if (!member) {
    throw new Error("profil pembeli belum lengkap");
  }
  const product = store2.data.products.find((item) => item.id === input.productId && item.active);
  const plan = store2.data.plans.find((item) => item.id === input.planId && item.productId === input.productId && item.isActive);
  if (!product || !plan) {
    throw new Error("produk atau paket tidak tersedia");
  }
  const reusable = store2.data.orders.find((order2) => order2.memberId === member.id && order2.productId === product.id && order2.planId === plan.id && order2.status === "pending" && Boolean(order2.expiresAt && new Date(order2.expiresAt) > now));
  if (reusable) {
    return reusable;
  }
  const order = await createCheckout(store2, member.id, product.id, now, {
    planId: plan.id,
    price: plan.price,
    telegramId: input.telegramId,
    lifetimeMinutes: telegramInvoiceLifetimeMinutes,
    reusePending: true
  });
  if (!store2.data.auditLogs.some((item) => item.action === "telegram.checkout.created" && item.targetId === order.id)) {
    audit(store2, input.telegramId, "telegram.checkout.created", "order", order.id, now);
    store2.save();
  }
  return order;
}
function submitPaymentProof(store2, input, now = /* @__PURE__ */ new Date()) {
  const member = store2.data.members.find((item) => item.telegramId === input.telegramId);
  const order = member && store2.data.orders.find((item) => item.memberId === member.id && item.invoiceNumber === input.invoiceNumber);
  if (!order) throw new Error("order tidak ditemukan");
  if (order.status !== "pending") throw new Error("invoice tidak dapat menerima bukti");
  if (order.expiresAt && new Date(order.expiresAt) <= now) throw new Error("invoice sudah kedaluwarsa");
  const fileId = input.fileId.trim();
  if (!fileId) throw new Error("foto bukti pembayaran wajib diisi");
  if (order.paymentProofStatus === "submitted" && order.paymentProofFileId === fileId) return order;
  order.paymentProofFileId = fileId;
  order.paymentProofStatus = "submitted";
  order.paymentProofSubmittedAt = now.toISOString();
  order.paymentProofReviewedAt = void 0;
  order.paymentProofRejectionReason = void 0;
  order.paymentProofReviewerTelegramId = void 0;
  audit(store2, input.telegramId, "telegram.payment_proof.submitted", "order", order.id, now);
  store2.save();
  return order;
}
function listSubmittedPaymentProofs(store2) {
  return store2.data.orders.filter((order) => order.paymentProofStatus === "submitted").sort((a, b) => (b.paymentProofSubmittedAt ?? "").localeCompare(a.paymentProofSubmittedAt ?? ""));
}
function reviewPaymentProof(store2, input, now = /* @__PURE__ */ new Date()) {
  assertConfiguredOwner(store2, input.ownerTelegramId);
  const order = store2.data.orders.find((item) => item.invoiceNumber === input.invoiceNumber || item.id === input.invoiceNumber);
  if (!order || !order.paymentProofFileId) throw new Error("bukti pembayaran tidak ditemukan");
  if (order.status === "expired") throw new Error("invoice harus dibuka kembali");
  if (input.decision === "approve" && order.paymentProofStatus === "approved" && order.status === "paid") {
    const subscription2 = store2.data.subscriptions.find((item) => item.memberId === order.memberId && item.productId === order.productId);
    const license2 = store2.data.licenses.find((item) => item.orderId === order.id);
    return { order, subscription: subscription2, license: license2 };
  }
  const reason = input.reason?.trim();
  if (input.decision === "reject" && !reason) throw new Error("alasan penolakan wajib diisi");
  if (input.decision === "reject" && order.paymentProofStatus === "rejected" && order.paymentProofRejectionReason === reason) return { order };
  if (order.status !== "pending" || order.paymentProofStatus !== "submitted") throw new Error("bukti pembayaran tidak dapat ditinjau");
  let subscription;
  let license;
  if (input.decision === "approve") {
    ({ subscription } = markOrderPaidByInvoice(store2, input.invoiceNumber, now));
    if (order.customerHwid) {
      license = generateLicenseForPaidOrder(store2, {
        invoiceNumber: input.invoiceNumber,
        hwid: order.customerHwid,
        now
      });
      order.licenseId = license.id;
    }
    order.paymentProofStatus = "approved";
  } else {
    order.paymentProofStatus = "rejected";
    order.paymentProofRejectionReason = reason;
  }
  order.paymentProofReviewedAt = now.toISOString();
  order.paymentProofReviewerTelegramId = input.ownerTelegramId;
  audit(store2, input.ownerTelegramId, `telegram.payment_proof.${input.decision === "approve" ? "approved" : "rejected"}`, "order", order.id, now);
  store2.save();
  return { order, subscription, license };
}
function reopenTelegramInvoice(store2, input, now = /* @__PURE__ */ new Date()) {
  assertConfiguredOwner(store2, input.ownerTelegramId);
  const order = store2.data.orders.find((item) => item.invoiceNumber === input.invoiceNumber || item.id === input.invoiceNumber);
  if (!order || order.status !== "expired" || order.paymentProofStatus !== "submitted" || !order.paymentProofFileId) {
    throw new Error("invoice tidak dapat dibuka kembali");
  }
  order.status = "pending";
  order.expiresAt = new Date(now.getTime() + telegramInvoiceLifetimeMinutes * 6e4).toISOString();
  audit(store2, input.ownerTelegramId, "telegram.invoice.reopened", "order", order.id, now);
  store2.save();
  return order;
}
function assertTelegramOrderOwner(store2, telegramId, invoiceNumber) {
  const member = store2.data.members.find((item) => item.telegramId === telegramId);
  const order = member && store2.data.orders.find((item) => item.memberId === member.id && (item.invoiceNumber === invoiceNumber || item.id === invoiceNumber));
  if (!order) throw new Error("order tidak ditemukan");
  return order;
}
function listTelegramBuyerLicenses(store2, telegramId) {
  const member = store2.data.members.find((item) => item.telegramId === telegramId);
  if (!member) return [];
  const orderIds = new Set(store2.data.orders.filter((order) => order.memberId === member.id).map((order) => order.id));
  return store2.data.licenses.filter((license) => license.orderId && orderIds.has(license.orderId)).map((license) => ({ ...license }));
}

// src/server/digital-downloads.ts
import crypto6 from "crypto";
import fs6 from "fs";
import path6 from "path";
var hashToken = (token) => crypto6.createHash("sha256").update(token).digest("hex");
function isPrivateHost(hostname) {
  const host = hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (host === "localhost" || host === "::1" || host.endsWith(".localhost")) return true;
  const parts = host.split(".").map(Number);
  if (parts.length === 4 && parts.every(Number.isInteger)) {
    return parts[0] === 10 || parts[0] === 127 || parts[0] === 0 || parts[0] === 169 && parts[1] === 254 || parts[0] === 192 && parts[1] === 168 || parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31;
  }
  return host.includes("::ffff:127.") || host.startsWith("fc") || host.startsWith("fd") || host.startsWith("fe8") || host.startsWith("fe9") || host.startsWith("fea") || host.startsWith("feb");
}
function validateDownloadSource(source) {
  if (path6.isAbsolute(source)) {
    const root = path6.resolve("data/digital-products");
    const resolved = path6.resolve(source);
    if (resolved !== root && !resolved.startsWith(root + path6.sep)) throw new Error("path file lokal tidak diizinkan");
    if (!fs6.existsSync(resolved) || !fs6.statSync(resolved).isFile()) throw new Error("file produk digital tidak tersedia");
    return { kind: "local", value: resolved };
  }
  let url;
  try {
    url = new URL(source);
  } catch {
    throw new Error("sumber download tidak valid");
  }
  if (url.protocol !== "https:") throw new Error("sumber download remote harus HTTPS");
  if (url.username || url.password || isPrivateHost(url.hostname)) throw new Error("host jaringan privat tidak diizinkan");
  const allowlist = (process.env.ASISTENQ_DOWNLOAD_HOSTS ?? "").split(",").map((item) => item.trim().toLowerCase()).filter(Boolean);
  if (allowlist.length && !allowlist.includes(url.hostname.toLowerCase())) throw new Error("host download tidak diizinkan");
  return { kind: "remote", value: url.toString() };
}
function createDownloadGrant(store2, orderId, now, fixedToken, action) {
  const order = store2.data.orders.find((item) => item.id === orderId && item.status === "paid");
  if (!order) throw new Error("order paid tidak ditemukan");
  const product = store2.data.products.find((item) => item.id === order.productId);
  if (!product || product.fulfillmentType !== "download" || !product.downloadSourceUrl) throw new Error("file produk digital belum diatur");
  validateDownloadSource(product.downloadSourceUrl);
  const existing = store2.data.downloadGrants.find((item) => item.orderId === order.id && new Date(item.expiresAt) > now && item.downloadCount < item.maxDownloads);
  if (existing) throw new Error("gunakan penerbitan ulang untuk mengganti token aktif");
  const token = fixedToken ?? crypto6.randomBytes(32).toString("base64url");
  const grant = { id: crypto6.randomUUID(), orderId: order.id, memberId: order.memberId, productId: product.id, tokenHash: hashToken(token), expiresAt: new Date(now.getTime() + 864e5).toISOString(), maxDownloads: 3, downloadCount: 0, createdAt: now.toISOString() };
  store2.data.downloadGrants.push(grant);
  store2.data.auditLogs.push({ id: crypto6.randomUUID(), actorId: order.telegramId ?? order.memberId, action: `telegram.download.${action}`, targetType: "download_grant", targetId: grant.id, createdAt: now.toISOString() });
  store2.save();
  return { grant, token };
}
function issueDownloadGrant(store2, orderId, now = /* @__PURE__ */ new Date(), fixedToken) {
  return createDownloadGrant(store2, orderId, now, fixedToken, "issued");
}
function reissueDownloadGrant(store2, orderId, now = /* @__PURE__ */ new Date(), fixedToken) {
  for (const grant of store2.data.downloadGrants.filter((item) => item.orderId === orderId)) grant.expiresAt = now.toISOString();
  store2.save();
  return createDownloadGrant(store2, orderId, now, fixedToken, "reissued");
}
function consumeDownloadGrant(store2, token, now = /* @__PURE__ */ new Date()) {
  const grant = store2.data.downloadGrants.find((item) => item.tokenHash === hashToken(token));
  if (!grant) throw new Error("link download tidak valid");
  if (new Date(grant.expiresAt) <= now) throw new Error("link download kedaluwarsa");
  if (grant.downloadCount >= grant.maxDownloads) throw new Error("batas download habis");
  const order = store2.data.orders.find((item) => item.id === grant.orderId && item.status === "paid");
  const product = order && store2.data.products.find((item) => item.id === grant.productId && (item.id === order.productId || order.orderItems?.some((orderItem) => orderItem.productId === item.id)));
  if (!product?.downloadSourceUrl || product.fulfillmentType !== "download") throw new Error("file produk digital tidak tersedia");
  const source = validateDownloadSource(product.downloadSourceUrl);
  grant.downloadCount += 1;
  store2.save();
  return { grant, source };
}
function listBuyerDownloadGrants(store2, telegramId, _baseUrl, now = /* @__PURE__ */ new Date()) {
  const member = store2.data.members.find((item) => item.telegramId === telegramId);
  if (!member) return [];
  return store2.data.downloadGrants.filter((grant) => grant.memberId === member.id && new Date(grant.expiresAt) > now && grant.downloadCount < grant.maxDownloads).map((grant) => ({
    id: grant.id,
    orderId: grant.orderId,
    productId: grant.productId,
    expiresAt: grant.expiresAt,
    remainingDownloads: grant.maxDownloads - grant.downloadCount
  }));
}

// src/server/order-fulfillment.ts
import crypto7 from "crypto";
function legacyItem(store2, orderId) {
  const order = store2.data.orders.find((row) => row.id === orderId);
  const product = store2.data.products.find((row) => row.id === order.productId);
  const plan = store2.data.plans.find((row) => row.id === order.planId);
  if (!product || !plan) return [];
  return [{ id: `legacy-${order.id}`, productId: product.id, planId: plan.id, productName: product.name, planName: plan.name, unitAmount: order.amount, fulfillmentType: product.fulfillmentType ?? "license", fulfillmentStatus: "pending" }];
}
function fulfillPaidOrder(store2, orderId, now = /* @__PURE__ */ new Date()) {
  const order = store2.data.orders.find((row) => row.id === orderId);
  if (!order || order.status !== "paid") throw new Error("order paid tidak ditemukan");
  const member = store2.data.members.find((row) => row.id === order.memberId);
  if (!member) throw new Error("member tidak ditemukan");
  const items = order.orderItems ?? legacyItem(store2, orderId);
  if (!order.orderItems) order.orderItems = items;
  for (const item of items) {
    if (item.fulfillmentStatus === "fulfilled") continue;
    const product = store2.data.products.find((row) => row.id === item.productId);
    const plan = store2.data.plans.find((row) => row.id === item.planId);
    try {
      if (!product || !plan) throw new Error("produk atau paket fulfillment tidak ditemukan");
      if (item.fulfillmentType === "license") {
        if (!order.customerHwid) {
          item.fulfillmentStatus = "pending";
          delete item.fulfillmentError;
          continue;
        }
        const existing = store2.data.licenses.find((row) => row.orderId === order.id && row.productId === product.id && row.planId === plan.id);
        const license = existing ?? generateToolLicense(store2, { productSlug: product.slug, planCode: plan.code, email: order.customerEmail ?? member.email, hwid: order.customerHwid, now });
        license.orderId = order.id;
        item.fulfillmentReference = license.id;
      } else if (item.fulfillmentType === "download") {
        if (!product.downloadSourceUrl) throw new Error("file produk digital belum diatur");
        validateDownloadSource(product.downloadSourceUrl);
        let grant = store2.data.downloadGrants.find((row) => row.orderId === order.id && row.orderItemId === item.id);
        if (!grant) {
          const token = crypto7.randomBytes(32).toString("base64url");
          grant = { id: crypto7.randomUUID(), orderId: order.id, orderItemId: item.id, memberId: member.id, productId: product.id, tokenHash: crypto7.createHash("sha256").update(token).digest("hex"), expiresAt: new Date(now.getTime() + 864e5).toISOString(), maxDownloads: 3, downloadCount: 0, createdAt: now.toISOString() };
          store2.data.downloadGrants.push(grant);
          item.fulfillmentReference = token;
        }
      } else {
        const type = item.fulfillmentType;
        let grant = store2.data.accessGrants.find((row) => row.orderId === order.id && row.orderItemId === item.id);
        if (!grant) {
          const resource = type === "url" ? product.externalUrl : product.accessUrl;
          if (!resource) throw new Error("resource akses produk belum diatur");
          grant = { id: crypto7.randomUUID(), orderId: order.id, orderItemId: item.id, memberId: member.id, productId: product.id, type, resource, createdAt: now.toISOString() };
          store2.data.accessGrants.push(grant);
        }
        item.fulfillmentReference = grant.id;
      }
      item.fulfillmentStatus = "fulfilled";
      delete item.fulfillmentError;
    } catch (error) {
      item.fulfillmentStatus = "failed";
      item.fulfillmentError = error instanceof Error ? error.message : "fulfillment gagal";
    }
  }
  store2.save();
  return items;
}

// src/server/subscribers.ts
import crypto8 from "crypto";
function subscribeProductUpdates(store2, rawEmail, source = "footer", now = /* @__PURE__ */ new Date()) {
  const email = rawEmail.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error("email tidak valid");
  const existing = store2.data.subscribers.find((row) => row.email === email);
  if (existing) {
    existing.status = "active";
    store2.save();
    return existing;
  }
  const subscriber = { id: crypto8.randomUUID(), email, consentedAt: now.toISOString(), status: "active", source };
  store2.data.subscribers.push(subscriber);
  store2.save();
  return subscriber;
}
function subscribersCsv(store2) {
  const safe = (value) => `"${value.replace(/"/g, '""')}"`;
  return ["email,status,source,consentedAt", ...store2.data.subscribers.map((row) => [row.email, row.status, row.source, row.consentedAt].map(safe).join(","))].join("\n");
}

// src/server/product-media-storage.ts
import crypto9 from "crypto";
import fs7 from "fs";
import path7 from "path";
var allowed = /* @__PURE__ */ new Map([
  ["image/jpeg", { extensions: [".jpg", ".jpeg"], output: ".jpg", max: 8 * 1024 * 1024 }],
  ["image/png", { extensions: [".png"], output: ".png", max: 8 * 1024 * 1024 }],
  ["image/webp", { extensions: [".webp"], output: ".webp", max: 8 * 1024 * 1024 }],
  ["video/mp4", { extensions: [".mp4"], output: ".mp4", max: 40 * 1024 * 1024 }],
  ["video/webm", { extensions: [".webm"], output: ".webm", max: 40 * 1024 * 1024 }]
]);
var productMediaRoot = path7.resolve("data/product-media");
function saveProductMedia(input) {
  if (!/^[A-Za-z0-9_-]+$/.test(input.productId)) throw new Error("product media id tidak valid");
  const rule = allowed.get(input.mimeType);
  const extension = path7.extname(input.originalName).toLowerCase();
  if (!rule || !rule.extensions.includes(extension)) throw new Error("tipe file media tidak diizinkan");
  if (input.buffer.length > rule.max) throw new Error("ukuran file media terlalu besar");
  const root = path7.resolve(input.root ?? productMediaRoot);
  const directory = path7.join(root, input.productId);
  fs7.mkdirSync(directory, { recursive: true });
  const fileName = `${crypto9.randomUUID()}${rule.output}`;
  const absolutePath = path7.join(directory, fileName);
  fs7.writeFileSync(absolutePath, input.buffer, { flag: "wx" });
  return { absolutePath, relativePath: `${input.productId}/${fileName}`, bytes: input.buffer.length, mimeType: input.mimeType };
}
function removeProductMedia(relativePath, root = productMediaRoot) {
  const base = path7.resolve(root);
  const target = path7.resolve(base, relativePath);
  if (!target.startsWith(base + path7.sep)) throw new Error("path media tidak valid");
  fs7.rmSync(target, { force: true });
}

// src/server/index.ts
var app = express();
var isTest = process.env.VITEST === "true" || process.env.NODE_ENV === "test";
var store = isTest ? createMemoryStore() : createFileStore();
var port = Number(process.env.API_PORT ?? 4e3);
var isProduction = process.env.NODE_ENV === "production";
var publicDir = path8.resolve(process.cwd(), "dist");
var hasBuiltFrontend = fs8.existsSync(path8.join(publicDir, "index.html"));
var shouldServeFrontend = isProduction || hasBuiltFrontend;
var cpanelNodeBin = path8.join(process.env.HOME ?? "", "nodevenv/repositories/asistenq/20/bin");
if (!isProduction) {
  app.use(cors({ origin: ["http://127.0.0.1:3000", "http://localhost:3000"] }));
}
app.use(express.json());
var landingImportDir = path8.resolve("data/landing-imports");
var productAssetDir = path8.resolve("data/product-assets");
var digitalProductDir = path8.resolve("data/digital-products");
var paymentProofDir = path8.resolve("data/payment-proofs");
var bundledLandingDir = path8.resolve("landings");
var bundledToolDir = path8.resolve("tools-dist");
var retiredLandingPaths = /* @__PURE__ */ new Set(["/jadwalinaja"]);
var ignoredLandingZipPaths = [
  /^node_modules\//,
  /^src\//,
  /^\.git\//,
  /^\.env(?:\.|$)/,
  /^package(?:-lock)?\.json$/,
  /^pnpm-lock\.yaml$/,
  /^yarn\.lock$/,
  /^tsconfig(?:\..*)?\.json$/,
  /^vite\.config\./,
  /^README(?:\..*)?$/i,
  /^metadata\.json$/
];
function normalizeZipEntryName(entryName) {
  return entryName.replace(/\\/g, "/").replace(/^\/+/, "");
}
function shouldIgnoreLandingEntry(entryName) {
  return ignoredLandingZipPaths.some((pattern) => pattern.test(entryName));
}
var loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8)
});
var memberRegisterSchema = loginSchema.extend({
  name: z.string().min(2),
  whatsapp: z.string().min(8),
  telegramId: z.string().min(3)
});
var telegramBuyerSchema = z.object({
  telegramId: z.string().min(1),
  name: z.string().min(2),
  email: z.string().email(),
  whatsapp: z.string().min(8)
});
var telegramCheckoutSchema = z.object({
  productId: z.string().min(1),
  planId: z.string().min(1)
});
var paymentProofSchema = z.object({ invoiceNumber: z.string().min(1), fileId: z.string().min(1) });
var paymentReviewSchema = z.object({
  decision: z.enum(["approve", "reject"]),
  reason: z.string().trim().min(1).optional()
}).superRefine((value, context) => {
  if (value.decision === "reject" && !value.reason) context.addIssue({ code: "custom", message: "alasan penolakan wajib diisi" });
});
var desktopOrderSchema = z.object({
  productSlug: z.literal("vjstudio"),
  planCode: z.enum(["1M", "3M", "6M", "1Y"]),
  email: z.string().email(),
  hwid: z.string().trim().regex(/^[A-Za-z0-9]{16}$/, "HWID harus tepat 16 karakter huruf/angka."),
  idempotencyKey: z.string().trim().min(8).max(128),
  voucherCode: z.string().trim().max(40).optional()
});
var hwidOnlySchema = z.object({ hwid: z.string().trim().regex(/^[A-Za-z0-9]{16}$/, "HWID harus tepat 16 karakter huruf/angka.") });
var forgotPasswordSchema = z.object({
  email: z.string().email(),
  accountType: z.enum(["admin", "member"]).default("member")
});
var resetPasswordSchema = z.object({
  token: z.string().min(20),
  accountType: z.enum(["admin", "member"]).default("member"),
  password: z.string().min(8)
});
var productSchema = z.object({
  name: z.string().min(2),
  slug: z.string().min(2).regex(/^[a-z0-9-]+$/),
  type: z.enum(["tool", "course", "ebook", "video", "bundle", "free", "class"]),
  category: z.string().max(80).optional(),
  visibility: z.enum(["public", "private", "draft"]).optional(),
  accessMode: z.enum(["public", "free_member", "trial", "paid", "admin"]).optional(),
  billingPeriod: z.enum(["trial", "monthly", "annual", "lifetime", "one_time"]),
  price: z.number().int().nonnegative(),
  compareAtPrice: z.number().int().nonnegative().optional(),
  discountLabel: z.string().optional(),
  promoText: z.string().optional(),
  logoUrl: z.string().optional(),
  landingPath: z.string().regex(/^\/[a-z0-9-]+$/).optional(),
  landingTemplate: z.string().optional(),
  courseMaterials: z.array(z.object({
    id: z.string().min(1),
    type: z.enum(["youtube", "ebook", "link"]),
    title: z.string().min(1),
    url: z.string().url(),
    description: z.string().optional()
  })).optional(),
  ctaLabel: z.string().optional(),
  accessRequirement: z.string().optional(),
  destinationType: z.enum(["internal", "hosted", "external"]).optional(),
  externalUrl: z.string().url().optional(),
  openMode: z.enum(["same_tab", "new_tab", "wrapper"]).optional(),
  trackLiveUsers: z.boolean().optional(),
  fulfillmentType: z.enum(["license", "download", "url", "course"]).optional(),
  downloadSourceUrl: z.string().url().refine((value) => value.startsWith("https://"), "URL download harus HTTPS.").optional(),
  headline: z.string().optional(),
  description: z.string().optional(),
  coverUrl: z.string().optional(),
  accessUrl: z.string().optional(),
  marketplaceCoverUrl: z.string().optional(),
  marketplaceAccent: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  cardDescription: z.string().max(240).optional(),
  tags: z.array(z.string().trim().min(1).max(40)).max(12).optional(),
  badge: z.string().max(30).optional(),
  gallery: z.array(z.object({ id: z.string(), type: z.enum(["image", "video"]), url: z.string(), alt: z.string().optional(), sortOrder: z.number().int() })).optional(),
  benefits: z.array(z.object({ title: z.string(), description: z.string(), icon: z.string().optional() })).optional(),
  features: z.array(z.object({ title: z.string(), description: z.string(), icon: z.string().optional() })).optional(),
  specifications: z.record(z.string(), z.string()).optional(),
  changelog: z.string().optional(),
  productFaqs: z.array(z.object({ question: z.string(), answer: z.string() })).optional(),
  targetUsers: z.array(z.string().trim().min(1)).max(20).optional(),
  developer: z.string().optional(),
  version: z.string().optional(),
  fileSize: z.string().optional(),
  compatibility: z.string().optional(),
  language: z.string().optional(),
  latestUpdate: z.string().optional(),
  sku: z.string().optional(),
  demoUrl: z.string().url().optional(),
  documentationUrl: z.string().url().optional(),
  plans: z.array(z.object({
    code: z.string().min(1),
    name: z.string().min(1),
    price: z.number().int().nonnegative(),
    billingPeriod: z.enum(["trial", "monthly", "annual", "lifetime", "one_time"]),
    durationDays: z.number().int().positive().nullable(),
    isFree: z.boolean().optional(),
    isActive: z.boolean().optional(),
    badge: z.string().max(40).optional(),
    highlighted: z.boolean().optional(),
    sortOrder: z.number().int().optional()
  })).optional(),
  landingConfig: z.object({
    heroImageUrl: z.string().optional(),
    heroVideoUrl: z.string().optional(),
    themeColor: z.string().optional(),
    benefits: z.array(z.object({
      title: z.string(),
      description: z.string(),
      icon: z.string().optional()
    })).optional(),
    faqs: z.array(z.object({
      question: z.string(),
      answer: z.string()
    })).optional(),
    testimonials: z.array(z.object({
      name: z.string(),
      role: z.string(),
      content: z.string(),
      avatarUrl: z.string().optional()
    })).optional()
  }).optional()
});
var adminCreateSchema = memberRegisterSchema.extend({
  role: z.enum(["super_admin", "admin"]),
  scopes: z.array(z.enum(["admins", "products", "members", "orders", "subscriptions", "content"]))
});
var licenseProductQuerySchema = z.object({
  product: z.string().min(1)
});
var voucherQuerySchema = licenseProductQuerySchema.extend({
  code: z.string().min(1)
});
var generateLicenseSchema = z.object({
  productSlug: z.string().min(1),
  planCode: z.string().min(1),
  email: z.string().email(),
  hwid: z.string().trim().regex(/^[A-Za-z0-9]{16}$/, "HWID harus tepat 16 karakter huruf/angka.")
});
var licenseTokenSchema = z.object({
  productSlug: z.string().min(1),
  token: z.string().min(1),
  hwid: z.string().min(1)
});
var resetLicenseSchema = z.object({
  licenseId: z.string().min(1),
  newHwid: z.string().min(1)
});
var hwidActionSchema = z.object({
  productSlug: z.string().min(1),
  hwid: z.string().min(1),
  reason: z.string().default("")
});
var toolEventSchema = z.object({
  productSlug: z.string().min(1),
  eventType: z.string().min(1),
  hwid: z.string().optional(),
  email: z.string().email().optional(),
  message: z.string().optional(),
  metadata: z.record(z.unknown()).optional()
});
var analyticsHeartbeatSchema = z.object({
  visitorId: z.string().min(8).max(120),
  instanceId: z.string().min(8).max(120),
  productSlug: z.string().min(1).optional()
});
var analyticsEventSchema = z.object({
  visitorId: z.string().min(8).max(120),
  productSlug: z.string().min(1),
  eventType: z.enum(["detail_view", "tool_open", "checkout_click"])
});
var deploymentSettingsSchema = z.object({
  githubToken: z.string().optional(),
  githubRepo: z.string().min(3).default("effands/asistenq"),
  githubBranch: z.string().min(1).default("master"),
  telegramBotToken: z.string().optional(),
  telegramOwnerId: z.string().optional(),
  smtpHost: z.string().optional(),
  smtpPort: z.string().optional(),
  smtpUser: z.string().optional(),
  smtpPass: z.string().optional(),
  mailFrom: z.string().optional(),
  qrisStaticPayload: z.string().optional()
});
function publicProduct(product) {
  const metrics = analyticsOverview(store).products.find((item) => item.productId === product.id);
  const discountPercent = product.compareAtPrice && product.compareAtPrice > product.price ? Math.round((1 - product.price / product.compareAtPrice) * 100) : 0;
  const { downloadSourceUrl: _privateDownloadSource, ...safeProduct } = product;
  return {
    ...safeProduct,
    downloadSourceConfigured: Boolean(_privateDownloadSource),
    destinationType: product.destinationType ?? "internal",
    openMode: product.openMode ?? (product.destinationType === "external" ? "new_tab" : "same_tab"),
    trackLiveUsers: product.trackLiveUsers ?? product.destinationType !== "external",
    formattedPrice: formatCurrency(product.price),
    discountPercent,
    analytics: metrics
  };
}
function publicOrder(order) {
  const product = store.data.products.find((item) => item.id === order.productId);
  const member = store.data.members.find((m) => m.id === order.memberId);
  return {
    ...order,
    product: product ? publicProduct(product) : void 0,
    formattedAmount: formatCurrency(order.amount),
    formattedTotalAmount: formatCurrency(order.totalAmount ?? order.amount),
    expiresAt: order.expiresAt,
    reminderSentAt: order.reminderSentAt,
    memberName: member?.name,
    memberEmail: member?.email
  };
}
function publicTelegramOrder(order) {
  const {
    memberId: _memberId,
    paymentProofFileId: _paymentProofFileId,
    paymentProofReviewerTelegramId: _paymentProofReviewerTelegramId,
    ...safeOrder
  } = order;
  const product = listTelegramCatalog(store).find((item) => item.id === order.productId);
  return {
    ...safeOrder,
    product,
    formattedAmount: formatCurrency(order.amount),
    formattedTotalAmount: formatCurrency(order.totalAmount ?? order.amount)
  };
}
function publicTelegramBuyer(member) {
  const { passwordHash: _passwordHash, ...safeMember } = member;
  return safeMember;
}
var publicTelegramErrors = /* @__PURE__ */ new Set([
  "email sudah terhubung ke akun Telegram lain",
  "email sudah terdaftar; hubungkan Telegram melalui dashboard",
  "profil pembeli belum lengkap",
  "produk atau paket tidak tersedia",
  "semua kode unik pembayaran sedang digunakan; coba lagi nanti"
]);
function publicTelegramError(error, fallback) {
  if (error instanceof z.ZodError) {
    return error.issues.map((issue) => issue.message).join(", ");
  }
  if (error instanceof Error && publicTelegramErrors.has(error.message)) {
    return error.message;
  }
  console.error(fallback, error);
  return fallback;
}
async function runGitHubDeployUpdate(githubToken) {
  const settings2 = store.data.deploymentSettings ?? {};
  const { githubRepo, githubBranch } = parseDeploymentSettings(settings2);
  const remote = buildGitHubRemote(githubRepo, githubToken);
  const hasLockfile = fs8.existsSync(path8.resolve("package-lock.json"));
  const commandOptions = {
    cwd: process.cwd(),
    timeout: 18e4,
    maxBuffer: 1024 * 1024,
    env: {
      ...process.env,
      PATH: fs8.existsSync(cpanelNodeBin) ? `${cpanelNodeBin}${path8.delimiter}${process.env.PATH ?? ""}` : process.env.PATH
    }
  };
  const results = [
    await runCommand("git", deploymentPullArgs(remote, githubBranch), commandOptions),
    await runCommand("npm", deploymentInstallArgs(hasLockfile), commandOptions),
    await runCommand("npm", deploymentAuditArgs(), commandOptions),
    await runCommand("npm", ["run", "build:hosting"], commandOptions)
  ];
  fs8.mkdirSync(path8.resolve("tmp"), { recursive: true });
  fs8.writeFileSync(path8.resolve("tmp/restart.txt"), (/* @__PURE__ */ new Date()).toISOString());
  return {
    stdout: hideSecret(results.map((result) => result.stdout).join("\n"), githubToken),
    stderr: hideSecret(results.map((result) => result.stderr).join("\n"), githubToken)
  };
}
function scheduleNodeRestartAfterResponse(res) {
  if (process.env.NODE_ENV === "production" || process.env.PASSENGER_APP_ENV) {
    res.on("finish", () => {
      schedulePassengerRestart(process.cwd());
      setTimeout(() => process.exit(0), 800);
    });
  }
}
async function emailInvoice(orderId) {
  try {
    const order = store.data.orders.find((item) => item.id === orderId);
    const member = store.data.members.find((item) => item.id === order?.memberId);
    if (!order || !member) return;
    await sendMail({
      to: member.email,
      subject: `Invoice AsistenQ ${order.invoiceNumber ?? order.id}`,
      html: formatInvoiceHtml(store, order.id, member.id)
    });
  } catch (error) {
    console.warn("Invoice email skipped:", error instanceof Error ? error.message : error);
  }
}
async function sendPendingOrderReminders() {
  const now = /* @__PURE__ */ new Date();
  let changed = false;
  for (const order of store.data.orders) {
    if (order.status !== "pending" || order.reminderSentAt) continue;
    const createdAt = new Date(order.createdAt);
    const shouldRemindAt = new Date(createdAt.getTime() + invoiceReminderHours * 60 * 60 * 1e3);
    const expiresAt = order.expiresAt ? new Date(order.expiresAt) : void 0;
    if (shouldRemindAt > now || expiresAt && expiresAt <= now) continue;
    const member = store.data.members.find((item) => item.id === order.memberId);
    if (!member) continue;
    await sendMail({
      to: member.email,
      subject: `Reminder pembayaran ${order.invoiceNumber ?? order.id}`,
      html: `<h1>Reminder Invoice AsistenQ</h1>
        <p>Invoice <b>${order.invoiceNumber ?? order.id}</b> masih menunggu pembayaran.</p>
        <p>Total bayar: <b>${formatCurrency(order.totalAmount ?? order.amount)}</b></p>
        <p>Batas bayar: <b>${order.expiresAt ? new Date(order.expiresAt).toLocaleString("id-ID") : "24 jam setelah order"}</b></p>
        <p>Silakan login ke akun member AsistenQ untuk melihat QRIS dan download invoice.</p>`
    });
    order.reminderSentAt = now.toISOString();
    changed = true;
  }
  if (changed) store.save();
}
async function emailLicense(license, invoiceNumber) {
  try {
    const product = store.data.products.find((item) => item.id === license.productId);
    await sendMail({
      to: license.email,
      subject: `Lisensi AsistenQ ${product?.name ?? ""}`.trim(),
      html: `<h1>Lisensi AsistenQ</h1>
        <p>Invoice: ${invoiceNumber ?? "-"}</p>
        <p>Produk: ${product?.name ?? license.productId}</p>
        <p>HWID: <b>${license.hwid}</b></p>
        <p>Token lisensi:</p>
        <pre style="padding:16px;border-radius:12px;background:#062c28;color:#fff">${license.key}</pre>
        <p>Token juga tersedia di akun member AsistenQ.</p>`
    });
  } catch (error) {
    console.warn("License email skipped:", error instanceof Error ? error.message : error);
  }
}
function hasActiveProductAccess(memberId, productId) {
  const now = /* @__PURE__ */ new Date();
  return store.data.subscriptions.some((subscription) => subscription.memberId === memberId && subscription.productId === productId && subscription.status === "active" && new Date(subscription.endsAt) > now) || store.data.orders.some((order) => order.memberId === memberId && order.productId === productId && order.status === "paid");
}
function canOpenProduct(req, product) {
  const mode = product.accessMode ?? "public";
  const user = readSession(req);
  if (mode === "public" && product.price > 0) return true;
  if (mode === "public" && product.price === 0) {
    return user?.type === "member" || user?.type === "admin";
  }
  if (!user) return false;
  if (user.type === "admin") return true;
  if (mode === "admin") return false;
  if (mode === "free_member") return user.type === "member";
  if (user.type !== "member") return false;
  return hasActiveProductAccess(user.id, product.id);
}
function sendProductAccessDenied(req, res, product) {
  const user = readSession(req);
  const target = encodeURIComponent(product.landingPath ?? `/${product.slug}`);
  const action = user ? `<a href="/member#produk">Ambil akses di member area</a>` : `<a href="/member?next=${target}">Login member dulu</a>`;
  res.status(user ? 403 : 401).send(`<!doctype html>
<html lang="id">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Akses Member Dibutuhkan</title>
    <style>
      :root {
        --bg-grad: linear-gradient(135deg, #eaf7f1, #f5fbf7);
        --card-bg: rgba(255, 255, 255, 0.7);
        --card-border: rgba(0, 140, 134, 0.15);
        --text-main: #062c28;
        --text-sub: #3d5a55;
        --btn-bg: #062c28;
        --btn-hover: #008c86;
        --shadow: 0 32px 80px rgba(6, 44, 40, 0.12);
        --icon-bg: #dcf7ed;
        --icon-color: #0e3f35;
      }
      @media (prefers-color-scheme: dark) {
        :root {
          --bg-grad: linear-gradient(135deg, #0a1411, #12201c);
          --card-bg: rgba(18, 32, 28, 0.6);
          --card-border: rgba(255, 255, 255, 0.05);
          --text-main: #ffffff;
          --text-sub: #9caea9;
          --btn-bg: #008c86;
          --btn-hover: #5de0cb;
          --shadow: 0 32px 80px rgba(0, 0, 0, 0.4);
          --icon-bg: rgba(0, 140, 134, 0.2);
          --icon-color: #5de0cb;
        }
      }
      body {
        margin: 0; min-height: 100vh; display: grid; place-items: center;
        background: var(--bg-grad); font-family: 'Inter', system-ui, sans-serif; color: var(--text-main);
      }
      main {
        max-width: 440px; margin: 24px; padding: 48px 40px; text-align: center;
        border: 1px solid var(--card-border); border-radius: 32px;
        background: var(--card-bg); backdrop-filter: blur(24px); -webkit-backdrop-filter: blur(24px);
        box-shadow: var(--shadow);
        animation: fadeUp 0.6s cubic-bezier(0.16, 1, 0.3, 1) forwards;
      }
      .icon {
        width: 64px; height: 64px; margin: 0 auto 24px; display: grid; place-items: center;
        background: var(--icon-bg); color: var(--icon-color); border-radius: 20px;
      }
      .icon svg { width: 32px; height: 32px; stroke-width: 2.2; }
      h1 { margin: 0 0 12px; font-size: 28px; line-height: 1.2; font-weight: 800; letter-spacing: -0.02em; }
      p { color: var(--text-sub); line-height: 1.6; font-size: 15px; margin: 0 0 32px; }
      a {
        display: inline-flex; align-items: center; justify-content: center; gap: 8px;
        width: 100%; padding: 16px 24px; border-radius: 999px;
        background: var(--btn-bg); color: #fff; text-decoration: none; font-weight: 700; font-size: 15px;
        transition: all 0.2s; box-shadow: 0 8px 24px rgba(0,0,0,0.1); box-sizing: border-box;
      }
      a:hover { background: var(--btn-hover); transform: translateY(-2px); box-shadow: 0 12px 32px rgba(0,0,0,0.15); }
      @keyframes fadeUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
    </style>
  </head>
  <body>
    <main>
      <div class="icon">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round">
          <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
          <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
        </svg>
      </div>
      <h1>Akses tools belum terbuka.</h1>
      <p>${product.accessRequirement ?? "Silakan login member dan ambil akses produk dulu."}</p>
      ${action}
    </main>
  </body>
</html>`);
}
app.get("/api/health", (_req, res) => {
  res.json({ ok: true, app: "AsistenQ" });
});
function handleLegacyActivation(req, res) {
  const query = z.object({
    token: z.string().min(1),
    hwid: z.string().min(1)
  }).parse(req.query);
  try {
    res.json(activateLicense(store, {
      productSlug: "vjstudio",
      token: query.token,
      hwid: query.hwid
    }));
  } catch (error) {
    res.status(400).json({
      status: "error",
      message: error instanceof Error ? error.message : "Invalid parameters"
    });
  }
}
app.get("/activate", handleLegacyActivation);
app.get("/api/activate", handleLegacyActivation);
app.get("/packages", (_req, res) => {
  res.json(publicPlansForProduct(store, "vjstudio"));
});
app.get("/api/packages", (_req, res) => {
  res.json(publicPlansForProduct(store, "vjstudio"));
});
app.get("/api/license/products/:slug/config", (req, res) => {
  try {
    res.json(productLicenseConfig(store, String(req.params.slug)));
  } catch (error) {
    res.status(404).json({ message: error instanceof Error ? error.message : "product not found" });
  }
});
function desktopOrderDto(order) {
  const product = store.data.products.find((item) => item.id === order.productId);
  const plan = store.data.plans.find((item) => item.id === order.planId);
  const license = store.data.licenses.find((item) => item.id === order.licenseId || item.orderId === order.id);
  return {
    invoiceNumber: order.invoiceNumber,
    product: product ? { slug: product.slug, name: product.name } : void 0,
    plan: plan ? { code: plan.code, name: plan.name, durationDays: plan.durationDays } : void 0,
    amount: order.amount,
    discountAmount: order.discountAmount ?? 0,
    uniqueCode: order.uniqueCode ?? 0,
    totalAmount: order.totalAmount ?? order.amount,
    paymentQrUrl: order.paymentQrUrl,
    expiresAt: order.expiresAt,
    status: order.status,
    paymentProofStatus: order.paymentProofStatus ?? "none",
    paymentProofRejectionReason: order.paymentProofRejectionReason,
    license: license && order.status === "paid" ? { key: license.key, status: license.status, expiresAt: license.expiresAt, hwid: license.hwid } : void 0
  };
}
function accessibleDesktopOrder(req) {
  const invoice = String(req.params.invoice);
  const order = store.data.orders.find((item) => item.invoiceNumber === invoice || item.id === invoice);
  const accessToken = req.get("x-order-token") ?? "";
  return order && canAccessLicenseOrder(order, accessToken) ? order : void 0;
}
var desktopPaymentProofUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, callback) => callback(null, ["image/jpeg", "image/png", "image/webp"].includes(file.mimetype))
});
var productMediaUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 40 * 1024 * 1024, files: 1 } });
var profileAvatarUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, callback) => callback(null, ["image/jpeg", "image/png", "image/webp"].includes(file.mimetype))
});
app.post("/api/license/orders", async (req, res) => {
  try {
    const result = await createLicenseCheckout(store, desktopOrderSchema.parse(req.body));
    res.status(201).json({ ...desktopOrderDto(result.order), accessToken: result.accessToken });
  } catch (error) {
    const message2 = error instanceof z.ZodError ? error.issues.map((issue) => issue.message).join(", ") : error instanceof Error ? error.message : "Order tidak dapat dibuat.";
    res.status(400).json({ message: message2 });
  }
});
app.get("/api/license/orders/:invoice/status", (req, res) => {
  expirePendingOrders(store);
  const order = accessibleDesktopOrder(req);
  if (!order) {
    res.status(404).json({ message: "Order tidak ditemukan." });
    return;
  }
  res.json(desktopOrderDto(order));
});
app.post("/api/license/orders/:invoice/payment-proof", desktopPaymentProofUpload.single("file"), (req, res) => {
  const order = accessibleDesktopOrder(req);
  if (!order) {
    res.status(404).json({ message: "Order tidak ditemukan." });
    return;
  }
  if (order.status !== "pending" || !req.file) {
    res.status(400).json({ message: req.file ? "Invoice tidak dapat menerima bukti." : "Bukti gambar wajib diunggah." });
    return;
  }
  fs8.mkdirSync(paymentProofDir, { recursive: true });
  const previousFile = order.paymentProofFileId;
  const extension = req.file.mimetype === "image/png" ? ".png" : req.file.mimetype === "image/webp" ? ".webp" : ".jpg";
  const fileName = `${order.id.replace(/[^a-zA-Z0-9_-]/g, "")}-${Date.now()}${extension}`;
  fs8.writeFileSync(path8.join(paymentProofDir, fileName), req.file.buffer);
  order.paymentProofFileId = fileName;
  order.paymentProofStatus = "submitted";
  order.paymentProofSubmittedAt = (/* @__PURE__ */ new Date()).toISOString();
  store.save();
  if (previousFile && previousFile !== fileName) removePaymentProof(paymentProofDir, previousFile);
  res.json(desktopOrderDto(order));
});
app.get("/announcement", (_req, res) => {
  const product = store.data.products.find((item) => item.slug === "vjstudio");
  const announcement = store.data.announcements.find((item) => item.productId === product?.id && item.enabled);
  res.json(announcement ?? {});
});
app.get("/api/announcement", (_req, res) => {
  const product = store.data.products.find((item) => item.slug === "vjstudio");
  const announcement = store.data.announcements.find((item) => item.productId === product?.id && item.enabled);
  res.json(announcement ?? {});
});
app.get("/banned", (_req, res) => {
  const product = store.data.products.find((item) => item.slug === "vjstudio");
  const banned = store.data.bannedHwids.filter((item) => item.productId === product?.id).map((item) => item.hwid);
  res.type("text/plain").send(banned.join("\n"));
});
app.get("/api/banned", (_req, res) => {
  const product = store.data.products.find((item) => item.slug === "vjstudio");
  const banned = store.data.bannedHwids.filter((item) => item.productId === product?.id).map((item) => item.hwid);
  res.type("text/plain").send(banned.join("\n"));
});
app.get("/verify_voucher", (req, res) => {
  const query = z.object({
    code: z.string().min(1)
  }).parse(req.query);
  res.json(verifyVoucher(store, {
    productSlug: "vjstudio",
    code: query.code
  }));
});
app.get("/api/verify_voucher", (req, res) => {
  const query = z.object({
    code: z.string().min(1)
  }).parse(req.query);
  res.json(verifyVoucher(store, {
    productSlug: "vjstudio",
    code: query.code
  }));
});
app.post("/api/admin/login", async (req, res) => {
  try {
    const body = loginSchema.parse(req.body);
    const admin = await verifyAdminLogin(store, body.email, body.password);
    const token = signSession({
      id: admin.id,
      email: admin.email,
      type: "admin",
      role: admin.role,
      scopes: admin.scopes
    });
    res.setHeader("Set-Cookie", sessionCookie(token, isProduction));
    res.json({ token, user: { id: admin.id, name: admin.name, email: admin.email, role: admin.role, scopes: admin.scopes } });
  } catch {
    res.status(401).json({ message: "Email atau password admin salah." });
  }
});
app.post("/api/member/register", async (req, res) => {
  try {
    const body = memberRegisterSchema.parse(req.body);
    const member = await createMember(store, body);
    const token = signSession({ id: member.id, email: member.email, type: "member" });
    res.setHeader("Set-Cookie", sessionCookie(token, isProduction));
    res.status(201).json({ token, user: { id: member.id, name: member.name, email: member.email } });
  } catch (error) {
    res.status(400).json({ message: error instanceof Error ? error.message : "register failed" });
  }
});
app.post("/api/member/login", async (req, res) => {
  try {
    const body = loginSchema.parse(req.body);
    const member = await verifyMemberLogin(store, body.email, body.password);
    const token = signSession({ id: member.id, email: member.email, type: "member" });
    res.setHeader("Set-Cookie", sessionCookie(token, isProduction));
    res.json({ token, user: { id: member.id, name: member.name, email: member.email, whatsapp: member.whatsapp, telegramId: member.telegramId, avatarUrl: member.avatarUrl } });
  } catch (error) {
    res.status(401).json({ message: error instanceof Error ? error.message : "login failed" });
  }
});
app.post("/api/auth/logout", (_req, res) => {
  res.setHeader("Set-Cookie", clearSessionCookie());
  res.json({ ok: true });
});
app.post("/api/auth/forgot-password", async (req, res) => {
  const body = forgotPasswordSchema.parse(req.body);
  const result = await requestPasswordReset(store, body);
  const showResetLink = !isProduction || process.env.SHOW_RESET_LINKS === "true";
  res.json({
    ok: true,
    message: "Jika email terdaftar, instruksi reset password sudah disiapkan.",
    ...showResetLink && result.resetUrl ? { resetUrl: result.resetUrl, expiresAt: result.expiresAt } : {}
  });
});
app.post("/api/auth/reset-password", async (req, res) => {
  const body = resetPasswordSchema.parse(req.body);
  await resetPassword(store, body);
  res.json({ ok: true, message: "Password berhasil diganti. Silakan login kembali." });
});
app.get("/api/products", (_req, res) => {
  res.json(store.data.products.filter((product) => product.active && product.visibility === "public").map((product) => ({ ...publicProduct(product), plans: store.data.plans.filter((plan) => plan.productId === product.id && plan.isActive) })));
});
app.get("/api/catalog", (_req, res) => {
  const catalog = publicCatalog(store);
  res.json({
    all: [...catalog.featured, ...catalog.paid, ...catalog.free].filter((product, index, products) => products.findIndex((item) => item.id === product.id) === index).map((product) => ({ ...publicProduct(product), plans: store.data.plans.filter((plan) => plan.productId === product.id && plan.isActive) })),
    featured: catalog.featured.map((product) => ({ ...publicProduct(product), plans: store.data.plans.filter((plan) => plan.productId === product.id && plan.isActive) })),
    paid: catalog.paid.map((product) => ({ ...publicProduct(product), plans: store.data.plans.filter((plan) => plan.productId === product.id && plan.isActive) })),
    free: catalog.free.map((product) => ({ ...publicProduct(product), plans: store.data.plans.filter((plan) => plan.productId === product.id && plan.isActive) })),
    onlineUsers: analyticsOverview(store).onlineUsers
  });
});
app.get("/api/content/:slug", (req, res) => {
  try {
    res.json(publishedContent(store, String(req.params.slug)));
  } catch {
    res.status(404).json({ message: "Halaman tidak ditemukan." });
  }
});
app.get("/api/admin/content", requireSession, requireAdminScope("content"), (_req, res) => res.json(store.data.contentPages));
app.put("/api/admin/content/:id", requireSession, requireAdminScope("content"), (req, res) => {
  try {
    const body = z.object({ title: z.string().min(2).optional(), summary: z.string().optional(), body: z.string().min(1), published: z.boolean() }).parse(req.body);
    res.json(updateContentPage(store, String(req.params.id), body));
  } catch (error) {
    res.status(400).json({ message: error instanceof Error ? error.message : "Konten gagal disimpan." });
  }
});
app.post("/api/subscribers", (req, res) => {
  try {
    const body = z.object({ email: z.string().email(), source: z.string().max(40).optional() }).parse(req.body);
    subscribeProductUpdates(store, body.email, body.source);
    res.status(201).json({ ok: true, message: "Terima kasih. Update produk akan dikirim ke email Anda." });
  } catch (error) {
    res.status(400).json({ message: error instanceof Error ? error.message : "Email gagal disimpan." });
  }
});
app.get("/api/admin/subscribers", requireSession, requireAdminScope("content"), (_req, res) => res.json(store.data.subscribers));
app.get("/api/admin/subscribers/export.csv", requireSession, requireAdminScope("content"), (_req, res) => {
  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", 'attachment; filename="asistenq-subscribers.csv"');
  res.send(subscribersCsv(store));
});
app.get("/api/product-media/:productId/:fileName", (req, res) => {
  const productId = String(req.params.productId);
  const fileName = String(req.params.fileName);
  if (!/^[A-Za-z0-9_-]+$/.test(productId) || !/^[A-Za-z0-9._-]+$/.test(fileName)) {
    res.status(404).end();
    return;
  }
  const url = `/api/product-media/${productId}/${fileName}`;
  const product = store.data.products.find((row) => row.id === productId && row.active && row.visibility === "public");
  const referenced = product && (product.marketplaceCoverUrl === url || product.gallery?.some((item) => item.url === url));
  if (!referenced) {
    res.status(404).end();
    return;
  }
  res.sendFile(path8.join(productMediaRoot, productId, fileName), (error) => {
    if (error && !res.headersSent) res.status(404).end();
  });
});
app.get("/api/products/:slug", (req, res) => {
  const product = store.data.products.find((item) => item.slug === req.params.slug && item.active && item.visibility === "public");
  if (!product) {
    res.status(404).json({ message: "product not found" });
    return;
  }
  res.json(publicProduct(product));
});
app.get("/api/license/packages", (req, res) => {
  const query = licenseProductQuerySchema.parse(req.query);
  res.json(publicPlansForProduct(store, query.product));
});
app.get("/api/license/announcement", (req, res) => {
  const query = licenseProductQuerySchema.parse(req.query);
  const product = store.data.products.find((item) => item.slug === query.product);
  const announcement = store.data.announcements.find((item) => item.productId === product?.id && item.enabled);
  res.json(announcement ?? {});
});
app.get("/api/license/banned", (req, res) => {
  const query = licenseProductQuerySchema.parse(req.query);
  const product = store.data.products.find((item) => item.slug === query.product);
  const banned = store.data.bannedHwids.filter((item) => item.productId === product?.id).map((item) => item.hwid);
  res.type("text/plain").send(banned.join("\n"));
});
app.get("/api/license/verify-voucher", (req, res) => {
  const query = voucherQuerySchema.parse(req.query);
  res.json(verifyVoucher(store, {
    productSlug: query.product,
    code: query.code
  }));
});
app.post("/api/license/activate", (req, res) => {
  const body = licenseTokenSchema.parse(req.body);
  res.json(activateLicense(store, body));
});
app.post("/api/license/verify", (req, res) => {
  const body = licenseTokenSchema.parse(req.body);
  res.json(verifyLicense(store, body));
});
app.post("/api/tool-events", (req, res) => {
  const eventSecret = process.env.TOOL_EVENT_SECRET;
  if (eventSecret && req.header("x-asistenq-tool-secret") !== eventSecret) {
    res.status(403).json({ message: "invalid tool event secret" });
    return;
  }
  const body = toolEventSchema.parse(req.body);
  store.data.auditLogs.push({
    id: createId("audit"),
    actorId: body.email ?? body.hwid ?? "anonymous-tool",
    action: `tool:${body.eventType}`,
    targetType: body.productSlug,
    targetId: body.hwid ?? body.email ?? body.productSlug,
    createdAt: (/* @__PURE__ */ new Date()).toISOString()
  });
  const product = store.data.products.find((item) => item.slug === body.productSlug);
  if (product && ["detail_view", "tool_open", "checkout_click"].includes(body.eventType)) {
    recordAnalyticsEvent(store, {
      productId: product.id,
      visitorId: body.email ?? body.hwid ?? "anonymous-tool",
      eventType: body.eventType
    });
  }
  store.save();
  res.status(201).json({ ok: true, message: "Tool event received" });
});
app.post("/api/analytics/heartbeat", (req, res) => {
  const body = analyticsHeartbeatSchema.parse(req.body);
  const product = body.productSlug ? store.data.products.find((item) => item.slug === body.productSlug && item.active) : void 0;
  const trackProduct = product && product.destinationType !== "external" && product.trackLiveUsers !== false ? product.id : void 0;
  heartbeatPresence({
    visitorId: body.visitorId,
    instanceId: body.instanceId,
    productId: trackProduct
  });
  const overview = analyticsOverview(store);
  res.json({
    ok: true,
    onlineUsers: overview.onlineUsers,
    toolOnlineUsers: trackProduct ? overview.products.find((item) => item.productId === trackProduct)?.onlineUsers ?? 0 : 0
  });
});
app.post("/api/analytics/event", (req, res) => {
  const body = analyticsEventSchema.parse(req.body);
  const product = store.data.products.find((item) => item.slug === body.productSlug && item.active);
  if (!product) {
    res.status(404).json({ message: "product not found" });
    return;
  }
  recordAnalyticsEvent(store, {
    productId: product.id,
    visitorId: body.visitorId,
    eventType: body.eventType
  });
  res.status(201).json({ ok: true });
});
app.post("/api/license/generate", requireSession, requireAdminScope("products"), (req, res) => {
  try {
    const body = generateLicenseSchema.parse(req.body);
    res.status(201).json(generateToolLicense(store, body));
  } catch (error) {
    const message2 = error instanceof z.ZodError ? error.issues.map((issue) => issue.message).join(", ") : error instanceof Error ? error.message : "Data lisensi tidak valid.";
    res.status(400).json({ message: message2 });
  }
});
app.post("/api/license/reset-device", requireSession, requireAdminScope("products"), (req, res) => {
  const body = resetLicenseSchema.parse(req.body);
  res.json(resetLicenseDevice(store, body));
});
app.post("/api/license/ban-hwid", requireSession, requireAdminScope("products"), (req, res) => {
  const body = hwidActionSchema.parse(req.body);
  res.status(201).json(banHwid(store, body));
});
app.post("/api/license/unban-hwid", requireSession, requireAdminScope("products"), (req, res) => {
  const body = hwidActionSchema.omit({ reason: true }).parse(req.body);
  res.json(unbanHwid(store, body));
});
app.get("/api/admin/summary", requireSession, requireAdminScope("products"), (_req, res) => {
  const analytics = analyticsOverview(store);
  res.json({
    products: store.data.products.length,
    members: store.data.members.length,
    orders: store.data.orders.length,
    licenses: store.data.licenses.length,
    activeSubscriptions: store.data.subscriptions.filter((item) => item.status === "active").length,
    onlineUsers: analytics.onlineUsers,
    toolOpens: analytics.totalToolOpens,
    detailViews: analytics.totalDetailViews,
    toolAnalytics: analytics.products
  });
});
app.get("/api/admin/analytics", requireSession, requireAdminScope("products"), (_req, res) => {
  res.json(analyticsOverview(store));
});
app.post("/api/admin/reset-operational-data", requireSession, requireAdminScope("products"), (_req, res) => {
  store.data.orders = [];
  store.data.subscriptions = [];
  store.data.licenses = [];
  store.data.bannedHwids = [];
  store.data.vouchers = [];
  store.data.passwordResets = [];
  store.data.auditLogs = [];
  store.data.toolAnalyticsEvents = [];
  store.save();
  res.json({ ok: true, message: "Data operasional berhasil direset." });
});
app.get("/api/admin/admins", requireSession, requireAdminScope("admins"), (_req, res) => {
  res.json(store.data.admins.map(({ passwordHash: _passwordHash, ...admin }) => admin));
});
app.post("/api/admin/admins", requireSession, requireAdminScope("admins"), async (req, res) => {
  const body = adminCreateSchema.parse(req.body);
  const admin = await createAdmin(store, {
    actor: { role: req.user?.role ?? "admin", scopes: req.user?.scopes ?? [] },
    ...body
  });
  const { passwordHash: _passwordHash, ...safeAdmin } = admin;
  res.status(201).json(safeAdmin);
});
app.get("/api/admin/products", requireSession, requireAdminScope("products"), (_req, res) => {
  res.json(store.data.products.map(publicProduct));
});
app.post("/api/admin/products/:id/media/cover", requireSession, requireAdminScope("products"), productMediaUpload.single("file"), (req, res) => {
  try {
    const product = store.data.products.find((row) => row.id === String(req.params.id));
    if (!product || !req.file) throw new Error("produk atau file tidak ditemukan");
    const saved = saveProductMedia({ productId: product.id, originalName: req.file.originalname, mimeType: req.file.mimetype, buffer: req.file.buffer });
    const previous = product.marketplaceCoverUrl;
    product.marketplaceCoverUrl = `/api/product-media/${saved.relativePath}`;
    product.updatedAt = (/* @__PURE__ */ new Date()).toISOString();
    store.save();
    if (previous?.startsWith("/api/product-media/")) removeProductMedia(previous.slice("/api/product-media/".length));
    res.status(201).json({ url: product.marketplaceCoverUrl });
  } catch (error) {
    res.status(400).json({ message: error instanceof Error ? error.message : "Upload cover gagal." });
  }
});
app.post("/api/admin/products/:id/media/gallery", requireSession, requireAdminScope("products"), productMediaUpload.single("file"), (req, res) => {
  try {
    const product = store.data.products.find((row) => row.id === String(req.params.id));
    if (!product || !req.file) throw new Error("produk atau file tidak ditemukan");
    const saved = saveProductMedia({ productId: product.id, originalName: req.file.originalname, mimeType: req.file.mimetype, buffer: req.file.buffer });
    const item = { id: createId("media"), type: req.file.mimetype.startsWith("video/") ? "video" : "image", url: `/api/product-media/${saved.relativePath}`, sortOrder: product.gallery?.length ?? 0 };
    product.gallery = [...product.gallery ?? [], item];
    product.updatedAt = (/* @__PURE__ */ new Date()).toISOString();
    store.save();
    res.status(201).json(item);
  } catch (error) {
    res.status(400).json({ message: error instanceof Error ? error.message : "Upload galeri gagal." });
  }
});
app.delete("/api/admin/products/:id/media/:mediaId", requireSession, requireAdminScope("products"), (req, res) => {
  const product = store.data.products.find((row) => row.id === String(req.params.id));
  const item = product?.gallery?.find((row) => row.id === String(req.params.mediaId));
  if (!product || !item) {
    res.status(404).json({ message: "Media tidak ditemukan." });
    return;
  }
  product.gallery = product.gallery?.filter((row) => row.id !== item.id).map((row, index) => ({ ...row, sortOrder: index }));
  store.save();
  if (item.url.startsWith("/api/product-media/")) removeProductMedia(item.url.slice("/api/product-media/".length));
  res.json({ ok: true });
});
app.put("/api/admin/members/:id", requireSession, requireAdminScope("members"), async (req, res) => {
  const schema = z.object({
    name: z.string().optional(),
    active: z.boolean().optional(),
    password: z.string().min(6).optional()
  });
  const body = schema.parse(req.body);
  const member = await updateMemberAccount(store, req.params.id, body);
  res.json({ success: true, member });
});
app.get("/api/admin/members", requireSession, requireAdminScope("products"), (_req, res) => {
  res.json(store.data.members.map(({ passwordHash: _passwordHash, ...member }) => {
    const memberOrders = store.data.orders.filter((order) => order.memberId === member.id);
    return {
      ...member,
      licenseCount: store.data.licenses.filter((license) => license.email === member.email).length,
      orderCount: memberOrders.length,
      subscriptionCount: store.data.subscriptions.filter((subscription) => subscription.memberId === member.id).length,
      latestOrder: memberOrders.sort((left, right) => right.createdAt.localeCompare(left.createdAt))[0]
    };
  }));
});
app.get("/api/admin/licenses", requireSession, requireAdminScope("products"), (_req, res) => {
  res.json(adminLicenseDashboard(store));
});
app.post("/api/admin/products", requireSession, requireAdminScope("products"), (req, res) => {
  try {
    const body = productSchema.parse(req.body);
    const product = createProductRecord(store, body);
    res.status(201).json(publicProduct(product));
  } catch (error) {
    const message2 = error instanceof z.ZodError ? error.issues.map((issue) => issue.message).join(", ") : error instanceof Error ? error.message : "Produk gagal ditambahkan.";
    res.status(400).json({ message: message2 });
  }
});
app.get("/api/member/profile", requireSession, (req, res) => {
  const member = req.user?.type === "member" ? store.data.members.find((item) => item.id === req.user?.id) : void 0;
  if (!member) {
    res.status(403).json({ message: "member access required" });
    return;
  }
  const { passwordHash: _passwordHash, ...profile } = member;
  res.json(profile);
});
app.put("/api/member/profile", requireSession, async (req, res) => {
  if (req.user?.type !== "member") {
    res.status(403).json({ message: "member access required" });
    return;
  }
  try {
    const body = z.object({
      name: z.string().trim().min(2).max(80).optional(),
      whatsapp: z.string().trim().max(30).optional(),
      telegramId: z.string().trim().max(80).optional(),
      currentPassword: z.string().min(6).optional(),
      newPassword: z.string().min(8).max(128).optional()
    }).refine((value) => !value.newPassword || Boolean(value.currentPassword), { message: "Password saat ini wajib diisi.", path: ["currentPassword"] }).parse(req.body);
    const member = await updateOwnMemberProfile(store, req.user.id, body);
    const { passwordHash: _passwordHash, ...profile } = member;
    res.json(profile);
  } catch (error) {
    const message2 = error instanceof z.ZodError ? error.issues.map((issue) => issue.message).join(", ") : error instanceof Error ? error.message : "Profil gagal diperbarui.";
    res.status(400).json({ message: message2 });
  }
});
app.post("/api/member/profile/avatar", requireSession, profileAvatarUpload.single("file"), (req, res) => {
  if (req.user?.type !== "member") {
    res.status(403).json({ message: "member access required" });
    return;
  }
  try {
    if (!req.file) throw new Error("Pilih foto JPG, PNG, atau WebP maksimal 5 MB.");
    const member = store.data.members.find((item) => item.id === req.user?.id);
    if (!member) throw new Error("Member tidak ditemukan.");
    const folderId = `member_${member.id}`;
    const saved = saveProductMedia({ productId: folderId, originalName: req.file.originalname, mimeType: req.file.mimetype, buffer: req.file.buffer });
    if (member.avatarUrl?.startsWith(`/api/profile-avatar/${folderId}/`)) {
      removeProductMedia(member.avatarUrl.slice("/api/profile-avatar/".length));
    }
    member.avatarUrl = `/api/profile-avatar/${saved.relativePath}`;
    store.save();
    res.status(201).json({ avatarUrl: member.avatarUrl });
  } catch (error) {
    res.status(400).json({ message: error instanceof Error ? error.message : "Foto profil gagal diupload." });
  }
});
app.get("/api/profile-avatar/:memberFolder/:fileName", (req, res) => {
  const memberFolder = String(req.params.memberFolder);
  const fileName = String(req.params.fileName);
  const url = `/api/profile-avatar/${memberFolder}/${fileName}`;
  if (!/^member_[A-Za-z0-9_-]+$/.test(memberFolder) || !/^[A-Za-z0-9._-]+$/.test(fileName) || !store.data.members.some((item) => item.avatarUrl === url)) {
    res.status(404).end();
    return;
  }
  res.sendFile(path8.join(productMediaRoot, memberFolder, fileName), (error) => {
    if (error && !res.headersSent) res.status(404).end();
  });
});
app.get("/api/downloads/vjstudio", (_req, res) => {
  res.redirect("https://drive.google.com/drive/folders/1MeZbmNSC0HoIFsYaOKmCZ1AWG-751Jsm?usp=sharing");
});
app.put("/api/admin/products/:id", requireSession, requireAdminScope("products"), (req, res) => {
  try {
    const body = productSchema.partial().parse(req.body);
    const product = updateProductRecord(store, String(req.params.id), body);
    res.json({ ...publicProduct(product), plans: store.data.plans.filter((plan) => plan.productId === product.id && plan.isActive) });
  } catch (error) {
    const message2 = error instanceof z.ZodError ? error.issues.map((issue) => issue.message).join(", ") : error instanceof Error ? error.message : "Produk gagal diperbarui.";
    res.status(message2 === "product not found" ? 404 : 400).json({ message: message2 });
  }
});
app.delete("/api/admin/products/:id", requireSession, requireAdminScope("products"), (req, res) => {
  try {
    const product = deleteProductRecord(store, String(req.params.id));
    const mediaUrls = [product.marketplaceCoverUrl, ...(product.gallery ?? []).map((item) => item.url)];
    for (const mediaUrl of mediaUrls) {
      if (mediaUrl?.startsWith("/api/product-media/")) removeProductMedia(mediaUrl.slice("/api/product-media/".length));
    }
    res.json({ ok: true, id: product.id });
  } catch (error) {
    const message2 = error instanceof Error ? error.message : "Produk gagal dihapus.";
    res.status(message2 === "product not found" ? 404 : 400).json({ message: message2 });
  }
});
app.patch("/api/admin/plans/:id", requireSession, requireAdminScope("products"), (req, res) => {
  try {
    res.json(updatePlanRecord(store, String(req.params.id), planPatchSchema.parse(req.body)));
  } catch (error) {
    const message2 = error instanceof z.ZodError ? error.issues.map((issue) => issue.message).join(", ") : error instanceof Error ? error.message : "Data paket tidak valid.";
    res.status(400).json({ message: message2 });
  }
});
app.post(
  "/api/admin/products/:id/landing-zip",
  requireSession,
  requireAdminScope("products"),
  express.raw({ type: ["application/zip", "application/x-zip-compressed", "application/octet-stream"], limit: "25mb" }),
  (req, res) => {
    const product = store.data.products.find((item) => item.id === String(req.params.id));
    if (!product) {
      res.status(404).json({ message: "product not found" });
      return;
    }
    if (!Buffer.isBuffer(req.body) || req.body.length === 0) {
      res.status(400).json({ message: "File ZIP kosong atau tidak terbaca." });
      return;
    }
    const safeSlug = product.slug.replace(/[^a-z0-9-]/g, "");
    const targetDir = path8.join(landingImportDir, safeSlug);
    fs8.rmSync(targetDir, { recursive: true, force: true });
    fs8.mkdirSync(targetDir, { recursive: true });
    const zip = new AdmZip(req.body);
    const entries = zip.getEntries();
    const hasBuiltDist = entries.some((entry) => normalizeZipEntryName(entry.entryName) === "dist/index.html");
    let fileCount = 0;
    let ignoredCount = 0;
    for (const entry of entries) {
      if (entry.isDirectory) continue;
      const normalizedName = entry.entryName.replace(/\\/g, "/").replace(/^\/+/, "");
      if (!normalizedName || normalizedName.includes("../")) continue;
      const outputName = hasBuiltDist ? normalizedName.replace(/^dist\//, "") : normalizedName;
      if (hasBuiltDist && normalizedName === outputName || shouldIgnoreLandingEntry(outputName)) {
        ignoredCount += 1;
        continue;
      }
      fileCount += 1;
      if (fileCount > 300) {
        res.status(400).json({ message: "ZIP terlalu besar: maksimal 300 file landing." });
        return;
      }
      const outputPath = path8.resolve(targetDir, outputName);
      if (!outputPath.startsWith(targetDir)) continue;
      fs8.mkdirSync(path8.dirname(outputPath), { recursive: true });
      fs8.writeFileSync(outputPath, entry.getData());
    }
    if (!fs8.existsSync(path8.join(targetDir, "index.html"))) {
      fs8.rmSync(targetDir, { recursive: true, force: true });
      res.status(400).json({ message: "ZIP belum berisi landing siap pakai. Upload folder dist hasil build, atau ZIP yang punya index.html di root." });
      return;
    }
    product.landingTemplate = "zip-html";
    product.destinationType = "hosted";
    product.openMode = "same_tab";
    product.trackLiveUsers = true;
    product.landingPath = product.landingPath ?? `/${safeSlug}`;
    product.accessUrl = product.landingPath;
    product.updatedAt = (/* @__PURE__ */ new Date()).toISOString();
    store.save();
    res.json({
      ok: true,
      message: `Landing ZIP tersimpan untuk ${product.name}.`,
      fileCount,
      ignoredCount,
      url: product.accessUrl
    });
  }
);
app.post(
  "/api/admin/products/:id/landing-html",
  requireSession,
  requireAdminScope("products"),
  express.raw({ type: ["text/html", "application/octet-stream"], limit: "5mb" }),
  (req, res) => {
    const product = store.data.products.find((item) => item.id === String(req.params.id));
    if (!product) {
      res.status(404).json({ message: "product not found" });
      return;
    }
    if (!Buffer.isBuffer(req.body) || req.body.length === 0) {
      res.status(400).json({ message: "File HTML kosong atau tidak terbaca." });
      return;
    }
    const html = req.body.toString("utf8");
    if (!/<html[\s>]/i.test(html) || !/<body[\s>]/i.test(html)) {
      res.status(400).json({ message: "File harus berupa dokumen HTML lengkap." });
      return;
    }
    const safeSlug = product.slug.replace(/[^a-z0-9-]/g, "");
    const targetDir = path8.join(landingImportDir, safeSlug);
    fs8.rmSync(targetDir, { recursive: true, force: true });
    fs8.mkdirSync(targetDir, { recursive: true });
    fs8.writeFileSync(path8.join(targetDir, "index.html"), html);
    product.landingTemplate = "single-html";
    product.destinationType = "hosted";
    product.openMode = "same_tab";
    product.trackLiveUsers = true;
    product.landingPath = product.landingPath ?? `/${safeSlug}`;
    product.accessUrl = product.landingPath;
    product.updatedAt = (/* @__PURE__ */ new Date()).toISOString();
    store.save();
    res.json({ ok: true, message: `HTML tersimpan untuk ${product.name}.`, url: product.accessUrl });
  }
);
app.post(
  "/api/admin/products/:id/logo",
  requireSession,
  requireAdminScope("products"),
  express.raw({ type: ["image/png", "image/jpeg", "image/webp", "application/octet-stream"], limit: "3mb" }),
  (req, res) => {
    const product = store.data.products.find((item) => item.id === String(req.params.id));
    if (!product) {
      res.status(404).json({ message: "product not found" });
      return;
    }
    if (!Buffer.isBuffer(req.body) || req.body.length === 0) {
      res.status(400).json({ message: "File gambar kosong atau tidak terbaca." });
      return;
    }
    const contentType = String(req.headers["content-type"] ?? "").split(";")[0];
    const extension = contentType === "image/jpeg" ? "jpg" : contentType === "image/webp" ? "webp" : "png";
    if (!["image/png", "image/jpeg", "image/webp", "application/octet-stream"].includes(contentType)) {
      res.status(400).json({ message: "Format gambar harus PNG, JPG, atau WEBP." });
      return;
    }
    fs8.mkdirSync(productAssetDir, { recursive: true });
    const safeSlug = product.slug.replace(/[^a-z0-9-]/g, "") || product.id;
    const filename = `${safeSlug}-${Date.now()}.${extension}`;
    fs8.writeFileSync(path8.join(productAssetDir, filename), req.body);
    product.logoUrl = `/product-assets/${filename}`;
    product.updatedAt = (/* @__PURE__ */ new Date()).toISOString();
    store.save();
    res.json({ ok: true, logoUrl: product.logoUrl, message: `Gambar ${product.name} tersimpan.` });
  }
);
function maskedSecret(value) {
  if (!value) return "";
  if (value.length <= 10) return "********";
  return `${value.slice(0, 4)}...${value.slice(-4)}`;
}
function hideSecret(text, secret) {
  return secret ? text.replaceAll(secret, "***") : text;
}
function requireBotSecret(req, res, next) {
  const configuredSecret = store.data.deploymentSettings?.botApiSecret ?? process.env.ASISTENQ_BOT_SECRET ?? "";
  if (!configuredSecret || req.header("x-asistenq-bot-secret") !== configuredSecret) {
    res.status(403).json({ message: "bot secret tidak valid" });
    return;
  }
  next();
}
function telegramUserId(req) {
  return String(req.header("x-telegram-user-id") ?? "").trim();
}
function requireTelegramIdentity(req, res, next) {
  if (!telegramUserId(req)) {
    res.status(400).json({ message: "Telegram ID wajib diisi" });
    return;
  }
  next();
}
function requireBotOwner(req, res, next) {
  const ownerId = store.data.deploymentSettings?.telegramOwnerId ?? process.env.TELEGRAM_OWNER_ID ?? "";
  if (!ownerId || telegramUserId(req) !== ownerId) {
    res.status(403).json({ message: "owner access required" });
    return;
  }
  next();
}
app.get("/api/admin/deploy/settings", requireSession, requireAdminScope("products"), (_req, res) => {
  const settings2 = store.data.deploymentSettings ?? {};
  const token = settings2.githubToken ?? process.env.GITHUB_TOKEN ?? "";
  const telegramToken = settings2.telegramBotToken ?? process.env.TELEGRAM_BOT_TOKEN ?? "";
  const smtpPass = settings2.smtpPass ?? process.env.SMTP_PASS ?? "";
  const botStatus = getTelegramBotStatus(store);
  res.json({
    githubRepo: settings2.githubRepo ?? "effands/asistenq",
    githubBranch: settings2.githubBranch ?? "master",
    hasGithubToken: Boolean(token),
    maskedGithubToken: maskedSecret(token),
    hasTelegramBotToken: Boolean(telegramToken),
    maskedTelegramBotToken: maskedSecret(telegramToken),
    telegramOwnerId: settings2.telegramOwnerId ?? process.env.TELEGRAM_OWNER_ID ?? "",
    smtpHost: settings2.smtpHost ?? process.env.SMTP_HOST ?? "mail.asistenq.com",
    smtpPort: settings2.smtpPort ?? process.env.SMTP_PORT ?? "465",
    smtpUser: settings2.smtpUser ?? process.env.SMTP_USER ?? "cs@asistenq.com",
    hasSmtpPass: Boolean(smtpPass),
    maskedSmtpPass: maskedSecret(smtpPass),
    mailFrom: settings2.mailFrom ?? process.env.MAIL_FROM ?? "AsistenQ <cs@asistenq.com>",
    qrisStaticPayload: settings2.qrisStaticPayload ?? "",
    botStatus,
    updatedAt: settings2.updatedAt
  });
});
app.post("/api/admin/deploy/settings", requireSession, requireAdminScope("products"), (req, res) => {
  const parsed = deploymentSettingsSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: "Data GitHub belum lengkap. Cek repository, branch, dan token." });
    return;
  }
  const body = parsed.data;
  const current = store.data.deploymentSettings ?? {};
  const nextToken = body.githubToken?.trim() || current.githubToken || process.env.GITHUB_TOKEN || "";
  const nextTelegramToken = body.telegramBotToken?.trim() || current.telegramBotToken || process.env.TELEGRAM_BOT_TOKEN || "";
  const nextTelegramOwnerId = body.telegramOwnerId?.trim() || current.telegramOwnerId || process.env.TELEGRAM_OWNER_ID || "";
  const nextSmtpPass = body.smtpPass?.trim() || current.smtpPass || process.env.SMTP_PASS || "";
  const nextSmtpHost = body.smtpHost?.trim() || current.smtpHost || process.env.SMTP_HOST || "mail.asistenq.com";
  const nextSmtpPort = body.smtpPort?.trim() || current.smtpPort || process.env.SMTP_PORT || "465";
  const nextSmtpUser = body.smtpUser?.trim() || current.smtpUser || process.env.SMTP_USER || "cs@asistenq.com";
  const nextMailFrom = body.mailFrom?.trim() || current.mailFrom || process.env.MAIL_FROM || "AsistenQ <cs@asistenq.com>";
  const isSmtpSave = Boolean(body.smtpHost || body.smtpPort || body.smtpUser || body.mailFrom || body.smtpPass !== void 0);
  if (isSmtpSave && !nextSmtpPass) {
    res.status(400).json({ message: "Password SMTP belum tersimpan. Isi kolom SMTP Password lalu klik Simpan SMTP lagi." });
    return;
  }
  try {
    const nextQrisStaticPayload = body.qrisStaticPayload === void 0 ? current.qrisStaticPayload ?? "" : validateStaticQrisPayload(body.qrisStaticPayload);
    const deploySettings = parseDeploymentSettings(body);
    store.data.deploymentSettings = {
      githubRepo: deploySettings.githubRepo,
      githubBranch: deploySettings.githubBranch,
      githubToken: nextToken,
      telegramBotToken: nextTelegramToken,
      telegramOwnerId: nextTelegramOwnerId,
      botApiSecret: current.botApiSecret,
      smtpHost: nextSmtpHost,
      smtpPort: nextSmtpPort,
      smtpUser: nextSmtpUser,
      smtpPass: nextSmtpPass,
      mailFrom: nextMailFrom,
      qrisStaticPayload: nextQrisStaticPayload,
      updatedAt: (/* @__PURE__ */ new Date()).toISOString()
    };
    store.save();
    const botStatus = getTelegramBotStatus(store);
    res.json({
      ok: true,
      message: "Token GitHub tersimpan.",
      githubRepo: store.data.deploymentSettings.githubRepo,
      githubBranch: store.data.deploymentSettings.githubBranch,
      hasGithubToken: Boolean(nextToken),
      maskedGithubToken: maskedSecret(nextToken),
      hasTelegramBotToken: Boolean(nextTelegramToken),
      maskedTelegramBotToken: maskedSecret(nextTelegramToken),
      telegramOwnerId: nextTelegramOwnerId,
      smtpHost: nextSmtpHost,
      smtpPort: nextSmtpPort,
      smtpUser: nextSmtpUser,
      hasSmtpPass: Boolean(nextSmtpPass),
      maskedSmtpPass: maskedSecret(nextSmtpPass),
      mailFrom: nextMailFrom,
      qrisStaticPayload: nextQrisStaticPayload,
      botStatus,
      updatedAt: store.data.deploymentSettings.updatedAt
    });
  } catch (error) {
    if (error instanceof Error && /QRIS|CRC|struktur/i.test(error.message)) {
      res.status(400).json({ message: error.message });
      return;
    }
    res.status(500).json({
      message: "Token gagal disimpan ke data server.",
      detail: error instanceof Error ? error.message : "unknown save error"
    });
  }
});
app.get("/api/admin/bot/status", requireSession, requireAdminScope("products"), (_req, res) => {
  res.json(getTelegramBotStatus(store));
});
app.post("/api/admin/bot/start", requireSession, requireAdminScope("products"), (_req, res) => {
  res.json(startTelegramBot(store));
});
app.post("/api/admin/bot/stop", requireSession, requireAdminScope("products"), (_req, res) => {
  res.json(stopTelegramBot());
});
var planPatchSchema = z.object({
  name: z.string().trim().min(1).optional(),
  price: z.number().int().nonnegative().optional(),
  durationDays: z.number().int().positive().nullable().optional(),
  isActive: z.boolean().optional(),
  badge: z.string().max(40).optional(),
  highlighted: z.boolean().optional(),
  sortOrder: z.number().int().optional()
});
app.post("/api/bot/buyer/register", requireBotSecret, requireTelegramIdentity, async (req, res) => {
  try {
    const body = telegramBuyerSchema.parse({ ...req.body, telegramId: telegramUserId(req) });
    res.json(publicTelegramBuyer(await registerTelegramBuyer(store, body)));
  } catch (error) {
    res.status(400).json({ message: publicTelegramError(error, "Registrasi pembeli gagal.") });
  }
});
app.get("/api/bot/buyer/products", requireBotSecret, requireTelegramIdentity, (_req, res) => {
  res.json({ products: listTelegramCatalog(store) });
});
app.post("/api/bot/buyer/checkout", requireBotSecret, requireTelegramIdentity, async (req, res) => {
  try {
    const body = telegramCheckoutSchema.parse(req.body);
    const order = await createTelegramCheckout(store, {
      ...body,
      telegramId: telegramUserId(req)
    });
    res.status(201).json(publicTelegramOrder(order));
  } catch (error) {
    res.status(400).json({ message: publicTelegramError(error, "Checkout gagal dibuat.") });
  }
});
app.get("/api/bot/buyer/orders", requireBotSecret, requireTelegramIdentity, (req, res) => {
  const member = store.data.members.find((item) => item.telegramId === telegramUserId(req));
  const orders = member ? store.data.orders.filter((item) => item.memberId === member.id).map(publicTelegramOrder) : [];
  res.json({ orders });
});
app.post("/api/bot/buyer/payment-proof", requireBotSecret, requireTelegramIdentity, (req, res) => {
  try {
    const body = paymentProofSchema.parse(req.body);
    res.json(publicTelegramOrder(submitPaymentProof(store, { ...body, telegramId: telegramUserId(req) })));
  } catch (error) {
    res.status(400).json({ message: publicTelegramError(error, "Bukti pembayaran gagal dikirim.") });
  }
});
app.post("/api/bot/buyer/orders/:invoice/hwid", requireBotSecret, requireTelegramIdentity, (req, res) => {
  try {
    const body = hwidOnlySchema.parse(req.body);
    assertTelegramOrderOwner(store, telegramUserId(req), String(req.params.invoice));
    const license = generateLicenseForPaidOrder(store, { invoiceNumber: String(req.params.invoice), hwid: body.hwid });
    void emailLicense(license, String(req.params.invoice));
    res.status(201).json(license);
  } catch (error) {
    res.status(400).json({ message: publicTelegramError(error, "Lisensi gagal dibuat.") });
  }
});
app.get("/api/bot/buyer/licenses", requireBotSecret, requireTelegramIdentity, (req, res) => {
  res.json({ licenses: listTelegramBuyerLicenses(store, telegramUserId(req)) });
});
app.post("/api/bot/buyer/orders/:invoice/download", requireBotSecret, requireTelegramIdentity, (req, res) => {
  try {
    const order = assertTelegramOrderOwner(store, telegramUserId(req), String(req.params.invoice));
    const active = store.data.downloadGrants.some((grant) => grant.orderId === order.id && new Date(grant.expiresAt) > /* @__PURE__ */ new Date() && grant.downloadCount < grant.maxDownloads);
    const issued = active ? reissueDownloadGrant(store, order.id) : issueDownloadGrant(store, order.id);
    const baseUrl = `${req.protocol}://${req.get("host")}`;
    res.status(201).json({
      grant: { id: issued.grant.id, orderId: issued.grant.orderId, productId: issued.grant.productId, expiresAt: issued.grant.expiresAt, remainingDownloads: issued.grant.maxDownloads },
      downloadUrl: `${baseUrl}/api/download/${encodeURIComponent(issued.token)}`
    });
  } catch (error) {
    res.status(400).json({ message: publicTelegramError(error, "Link download gagal dibuat.") });
  }
});
app.get("/api/bot/buyer/downloads", requireBotSecret, requireTelegramIdentity, (req, res) => {
  const baseUrl = `${req.protocol}://${req.get("host")}`;
  res.json({ grants: listBuyerDownloadGrants(store, telegramUserId(req), baseUrl) });
});
app.get("/api/download/:token", (req, res) => {
  try {
    const { source } = consumeDownloadGrant(store, String(req.params.token));
    if (source.kind === "local") {
      res.download(source.value);
      return;
    }
    res.redirect(302, source.value);
  } catch (error) {
    res.status(404).json({ message: publicTelegramError(error, "Link download tidak tersedia.") });
  }
});
app.use("/api/bot/owner", requireBotSecret, requireTelegramIdentity, requireBotOwner);
var telegramProductSchema = z.object({
  name: z.string().trim().min(2),
  slug: z.string().regex(/^[a-z0-9-]+$/),
  fulfillmentType: z.enum(["license", "download", "url", "course"]),
  description: z.string().trim(),
  status: z.enum(["public", "private", "draft"]),
  downloadSourceUrl: z.string().url().refine((value) => value.startsWith("https://"), "URL download harus HTTPS.").optional(),
  plan: z.object({
    code: z.string().trim().min(1),
    name: z.string().trim().min(1),
    price: z.number().int().nonnegative(),
    durationDays: z.number().int().positive().nullable()
  })
});
var telegramProductPatchSchema = telegramProductSchema.omit({ plan: true }).partial();
var telegramPlanPatchSchema = z.object({
  name: z.string().trim().min(1).optional(),
  price: z.number().int().nonnegative().optional(),
  durationDays: z.number().int().positive().nullable().optional(),
  isActive: z.boolean().optional()
});
var digitalProductUpload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, callback) => {
      fs8.mkdirSync(digitalProductDir, { recursive: true });
      callback(null, digitalProductDir);
    },
    filename: (_req, _file, callback) => callback(null, `${crypto10.randomUUID()}.zip`)
  }),
  limits: { fileSize: 50 * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, callback) => {
    const zipMime = /* @__PURE__ */ new Set(["application/zip", "application/x-zip-compressed", "application/octet-stream"]);
    callback(null, path8.extname(path8.basename(file.originalname)).toLowerCase() === ".zip" && zipMime.has(file.mimetype));
  }
});
app.post("/api/bot/owner/products", (req, res) => {
  try {
    const result = createTelegramProduct(store, telegramProductSchema.parse(req.body), telegramUserId(req));
    res.status(201).json({ product: publicProduct(result.product), plan: result.plan });
  } catch (error) {
    res.status(400).json({ message: publicTelegramError(error, "Produk gagal dibuat.") });
  }
});
app.patch("/api/bot/owner/products/:id", (req, res) => {
  try {
    res.json(publicProduct(updateTelegramProduct(store, String(req.params.id), telegramProductPatchSchema.parse(req.body), telegramUserId(req))));
  } catch (error) {
    res.status(400).json({ message: publicTelegramError(error, "Produk gagal diperbarui.") });
  }
});
app.post("/api/bot/owner/products/:id/deactivate", (req, res) => {
  try {
    res.json(publicProduct(deactivateTelegramProduct(store, String(req.params.id), telegramUserId(req))));
  } catch (error) {
    res.status(400).json({ message: publicTelegramError(error, "Produk gagal dinonaktifkan.") });
  }
});
app.patch("/api/bot/owner/plans/:id", (req, res) => {
  try {
    res.json(updateTelegramPlan(store, String(req.params.id), telegramPlanPatchSchema.parse(req.body), telegramUserId(req)));
  } catch (error) {
    res.status(400).json({ message: publicTelegramError(error, "Paket gagal diperbarui.") });
  }
});
app.post("/api/bot/owner/products/:id/digital-file", (req, res, next) => {
  digitalProductUpload.single("file")(req, res, (error) => {
    if (error) {
      res.status(400).json({ message: error instanceof multer.MulterError && error.code === "LIMIT_FILE_SIZE" ? "File ZIP maksimal 50 MB." : "Upload ZIP tidak valid." });
      return;
    }
    next();
  });
}, (req, res) => {
  if (!req.file) {
    res.status(400).json({ message: "File ZIP wajib diunggah." });
    return;
  }
  try {
    res.json(publicProduct(attachTelegramDigitalFile(store, String(req.params.id), req.file.path, telegramUserId(req))));
  } catch (error) {
    fs8.rmSync(req.file.path, { force: true });
    res.status(400).json({ message: publicTelegramError(error, "File digital gagal disimpan.") });
  }
});
app.get("/api/bot/owner/payment-proofs", (_req, res) => {
  res.json({ orders: listSubmittedPaymentProofs(store).map((order) => ({
    ...publicTelegramOrder(order),
    paymentProofFileId: order.paymentProofFileId,
    paymentProofSource: order.customerHwid ? "desktop" : "telegram"
  })) });
});
app.get("/api/bot/owner/payment-proofs/:invoice/file", (req, res) => {
  const order = store.data.orders.find((item) => item.invoiceNumber === String(req.params.invoice) || item.id === String(req.params.invoice));
  const fileName = order?.paymentProofFileId ? path8.basename(order.paymentProofFileId) : "";
  const filePath = fileName ? path8.join(paymentProofDir, fileName) : "";
  if (!filePath || !fs8.existsSync(filePath)) {
    res.status(404).json({ message: "Bukti pembayaran tidak ditemukan." });
    return;
  }
  res.sendFile(filePath);
});
app.post("/api/bot/owner/payment-proofs/:invoice/review", (req, res) => {
  try {
    const body = paymentReviewSchema.parse(req.body);
    const currentOrder = store.data.orders.find((item) => item.invoiceNumber === String(req.params.invoice) || item.id === String(req.params.invoice));
    const wasAlreadyApproved = currentOrder?.paymentProofStatus === "approved" && currentOrder.status === "paid";
    const result = reviewPaymentProof(store, { ...body, invoiceNumber: String(req.params.invoice), ownerTelegramId: telegramUserId(req) });
    const order = result.order;
    const product = store.data.products.find((item) => item.id === order.productId);
    const member = store.data.members.find((item) => item.id === order.memberId);
    let download;
    if (body.decision === "approve" && !wasAlreadyApproved && product?.fulfillmentType === "download") {
      const issued = issueDownloadGrant(store, order.id);
      const baseUrl = `${req.protocol}://${req.get("host")}`;
      download = { expiresAt: issued.grant.expiresAt, remainingDownloads: issued.grant.maxDownloads, downloadUrl: `${baseUrl}/api/download/${encodeURIComponent(issued.token)}` };
    }
    res.json({
      order: publicTelegramOrder(order),
      fulfillmentType: product?.fulfillmentType ?? "license",
      buyerTelegramId: member?.telegramId,
      license: result.license,
      download
    });
  } catch (error) {
    res.status(400).json({ message: publicTelegramError(error, "Bukti pembayaran gagal ditinjau.") });
  }
});
app.post("/api/bot/owner/orders/:invoice/reopen", (req, res) => {
  try {
    res.json(publicTelegramOrder(reopenTelegramInvoice(store, { invoiceNumber: String(req.params.invoice), ownerTelegramId: telegramUserId(req) })));
  } catch (error) {
    res.status(400).json({ message: publicTelegramError(error, "Invoice gagal dibuka kembali.") });
  }
});
var ownerBotMiddleware = [requireBotSecret, requireTelegramIdentity, requireBotOwner];
app.get("/api/bot/admin-summary", ...ownerBotMiddleware, (_req, res) => {
  res.json({
    products: store.data.products.length,
    members: store.data.members.length,
    orders: store.data.orders.length,
    licenses: store.data.licenses.length,
    activeSubscriptions: store.data.subscriptions.filter((item) => item.status === "active").length
  });
});
app.get("/api/bot/orders", ...ownerBotMiddleware, (_req, res) => {
  void sendPendingOrderReminders();
  res.json({ orders: listPendingOrders(store, 10) });
});
app.post("/api/bot/orders/paid", ...ownerBotMiddleware, (req, res) => {
  try {
    const body = z.object({ invoiceNumber: z.string().min(1) }).parse(req.body);
    const result = markOrderPaidByInvoice(store, body.invoiceNumber);
    res.json({ ok: true, order: publicOrder(result.order), subscription: result.subscription });
  } catch (error) {
    res.status(400).json({ message: error instanceof Error ? error.message : "Order gagal ditandai paid." });
  }
});
app.get("/api/bot/owner/license-products", ...ownerBotMiddleware, (_req, res) => {
  const products = store.data.products.filter((product) => product.active).map((product) => ({
    id: product.id,
    name: product.name,
    slug: product.slug,
    plans: store.data.plans.filter((plan) => plan.productId === product.id && plan.isActive).sort((left, right) => (left.sortOrder ?? 0) - (right.sortOrder ?? 0)).map((plan) => ({
      id: plan.id,
      code: plan.code,
      name: plan.name,
      durationDays: plan.durationDays
    }))
  })).filter((product) => product.plans.length > 0);
  res.json({ products });
});
app.post("/api/bot/license-generate", ...ownerBotMiddleware, (req, res) => {
  try {
    const body = generateLicenseSchema.parse(req.body);
    const result = generateDirectToolLicense(store, body);
    res.status(result.reused ? 200 : 201).json(result);
  } catch (error) {
    const message2 = error instanceof z.ZodError ? error.issues.map((issue) => issue.message).join(", ") : error instanceof Error ? error.message : "Data lisensi tidak valid.";
    res.status(400).json({ message: message2 });
  }
});
app.get("/api/bot/owner/licenses/:id/delivery", ...ownerBotMiddleware, (req, res) => {
  const license = store.data.licenses.find((item) => item.id === String(req.params.id));
  if (!license) {
    res.status(404).json({ message: "Lisensi tidak ditemukan." });
    return;
  }
  const email = license.email.trim().toLowerCase();
  const member = store.data.members.find((item) => item.active && item.email === email && item.telegramId);
  if (!member?.telegramId) {
    res.status(404).json({ message: "Email pembeli belum terhubung ke Telegram." });
    return;
  }
  res.json({ license, buyerTelegramId: member.telegramId });
});
app.post("/api/bot/license-send", ...ownerBotMiddleware, (req, res) => {
  try {
    const body = z.object({
      invoiceNumber: z.string().min(1),
      hwid: z.string().trim().regex(/^[A-Za-z0-9]{16}$/, "HWID harus tepat 16 karakter huruf/angka."),
      planCode: z.string().optional()
    }).parse(req.body);
    markOrderPaidByInvoice(store, body.invoiceNumber);
    const license = generateLicenseForPaidOrder(store, body);
    void emailLicense(license, body.invoiceNumber);
    res.status(201).json(license);
  } catch (error) {
    const message2 = error instanceof z.ZodError ? error.issues.map((issue) => issue.message).join(", ") : error instanceof Error ? error.message : "Lisensi gagal dibuat.";
    res.status(400).json({ message: message2 });
  }
});
app.get("/api/bot/banned", ...ownerBotMiddleware, (_req, res) => {
  const rows = store.data.bannedHwids.map((item) => {
    const product = store.data.products.find((candidate) => candidate.id === item.productId);
    return {
      ...item,
      productSlug: product?.slug ?? item.productId,
      productName: product?.name ?? item.productId
    };
  });
  res.json({ bannedHwids: rows });
});
app.post("/api/bot/ban-hwid", ...ownerBotMiddleware, (req, res) => {
  try {
    const body = hwidActionSchema.parse(req.body);
    res.status(201).json(banHwid(store, body));
  } catch (error) {
    const message2 = error instanceof z.ZodError ? error.issues.map((issue) => issue.message).join(", ") : error instanceof Error ? error.message : "HWID gagal dibanned.";
    res.status(400).json({ message: message2 });
  }
});
app.post("/api/bot/unban-hwid", ...ownerBotMiddleware, (req, res) => {
  try {
    const body = z.object({ productSlug: z.string().min(1), hwid: z.string().min(1) }).parse(req.body);
    res.json(unbanHwid(store, body));
  } catch (error) {
    const message2 = error instanceof z.ZodError ? error.issues.map((issue) => issue.message).join(", ") : error instanceof Error ? error.message : "HWID gagal di-unban.";
    res.status(400).json({ message: message2 });
  }
});
app.post("/api/bot/deploy-update", ...ownerBotMiddleware, async (_req, res) => {
  const settings2 = store.data.deploymentSettings ?? {};
  const githubToken = settings2.githubToken ?? process.env.GITHUB_TOKEN ?? "";
  try {
    const result = await runGitHubDeployUpdate(githubToken);
    scheduleNodeRestartAfterResponse(res);
    res.json({
      ok: true,
      message: "Update selesai. NodeJS akan restart otomatis. Bot Telegram akan menyalakan ulang prosesnya.",
      stdout: result.stdout,
      stderr: result.stderr
    });
  } catch (error) {
    const detail = hideSecret(error instanceof Error ? error.message : "deploy failed", githubToken);
    res.status(500).json({
      ok: false,
      message: "Update gagal. Cek log untuk detail.",
      detail
    });
  }
});
app.post("/api/admin/deploy/update", requireSession, requireAdminScope("products"), async (_req, res) => {
  const settings2 = store.data.deploymentSettings ?? {};
  const githubToken = settings2.githubToken ?? process.env.GITHUB_TOKEN ?? "";
  try {
    const result = await runGitHubDeployUpdate(githubToken);
    scheduleNodeRestartAfterResponse(res);
    res.json({
      ok: true,
      message: "Update selesai. NodeJS akan restart otomatis.",
      stdout: result.stdout,
      stderr: result.stderr
    });
  } catch (error) {
    const detail = hideSecret(error instanceof Error ? error.message : "deploy failed", githubToken);
    res.status(500).json({
      ok: false,
      message: "Update gagal. Cek log untuk detail.",
      detail
    });
  }
});
app.get("/api/admin/orders", requireSession, requireAdminScope("orders"), (_req, res) => {
  expirePendingOrders(store);
  void sendPendingOrderReminders();
  res.json(store.data.orders.map(publicOrder));
});
app.get("/api/admin/orders/:id/payment-proof", requireSession, requireAdminScope("orders"), (req, res) => {
  const order = store.data.orders.find((item) => item.id === String(req.params.id));
  const fileName = order?.paymentProofFileId ? path8.basename(order.paymentProofFileId) : "";
  const filePath = fileName ? path8.join(paymentProofDir, fileName) : "";
  if (!filePath || !fs8.existsSync(filePath)) {
    res.status(404).json({ message: "Bukti pembayaran tidak ditemukan." });
    return;
  }
  res.sendFile(filePath);
});
app.delete("/api/admin/orders/:id/payment-proof", requireSession, requireAdminScope("orders"), (req, res) => {
  const order = store.data.orders.find((item) => item.id === String(req.params.id));
  if (!order) {
    res.status(404).json({ message: "Order tidak ditemukan." });
    return;
  }
  const result = removePaymentProof(paymentProofDir, order.paymentProofFileId);
  order.paymentProofFileId = void 0;
  order.paymentProofSubmittedAt = void 0;
  if (order.paymentProofStatus === "submitted") order.paymentProofStatus = "none";
  store.save();
  res.json({ ok: true, ...result, message: `${result.files} bukti pembayaran dihapus.` });
});
app.delete("/api/admin/payment-proofs", requireSession, requireAdminScope("orders"), (_req, res) => {
  const result = clearPaymentProofDirectory(paymentProofDir);
  for (const order of store.data.orders) {
    order.paymentProofFileId = void 0;
    order.paymentProofSubmittedAt = void 0;
    if (order.paymentProofStatus === "submitted") order.paymentProofStatus = "none";
  }
  store.save();
  res.json({ ok: true, ...result, message: `${result.files} bukti pembayaran dibersihkan.` });
});
app.post("/api/admin/orders/:id/paid", requireSession, requireAdminScope("orders"), (req, res) => {
  try {
    const result = markOrderPaid(store, String(req.params.id));
    const fulfillment = result.order.orderItems ? fulfillPaidOrder(store, result.order.id) : void 0;
    const license = !result.order.orderItems && result.order.customerHwid ? generateLicenseForPaidOrder(store, { invoiceNumber: result.order.invoiceNumber ?? result.order.id, hwid: result.order.customerHwid }) : void 0;
    if (license) {
      result.order.licenseId = license.id;
      store.save();
    }
    res.json({ ok: true, order: publicOrder(result.order), subscription: result.subscription, license, fulfillment });
  } catch (error) {
    res.status(400).json({ message: error instanceof Error ? error.message : "Order gagal diverifikasi." });
  }
});
app.delete("/api/admin/orders/expired", requireSession, requireAdminScope("orders"), (_req, res) => {
  expirePendingOrders(store);
  const before = store.data.orders.length;
  store.data.orders = store.data.orders.filter((order) => order.status !== "expired");
  const deleted = before - store.data.orders.length;
  if (deleted > 0) store.save();
  res.json({ ok: true, deleted, message: `${deleted} order expired dihapus.` });
});
app.get("/api/admin/orders/export.csv", requireSession, requireAdminScope("orders"), (_req, res) => {
  expirePendingOrders(store);
  const headers = ["Invoice", "Member", "Email", "Produk", "Total", "Status", "Tanggal"];
  const rows = store.data.orders.map((order) => {
    const row = publicOrder(order);
    return [
      row.invoiceNumber ?? row.id,
      row.memberName ?? "",
      row.memberEmail ?? "",
      row.product?.name ?? row.productName ?? row.productId,
      row.formattedTotalAmount,
      row.status,
      row.createdAt
    ];
  });
  const csv = [headers, ...rows].map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(",")).join("\n");
  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", 'attachment; filename="asistenq-orders.csv"');
  res.send(`\uFEFF${csv}`);
});
app.get("/api/admin/orders/export.xls", requireSession, requireAdminScope("orders"), (_req, res) => {
  expirePendingOrders(store);
  const headers = ["Invoice", "Member", "Email", "Produk", "Total", "Status", "Tanggal"];
  const rows = store.data.orders.map((order) => {
    const row = publicOrder(order);
    return [
      row.invoiceNumber ?? row.id,
      row.memberName ?? "",
      row.memberEmail ?? "",
      row.product?.name ?? row.productName ?? row.productId,
      row.formattedTotalAmount,
      row.status,
      row.createdAt
    ];
  });
  const escapeCell = (value) => String(value).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  const tableRows = [headers, ...rows].map((row) => `<tr>${row.map((cell) => `<td>${escapeCell(cell)}</td>`).join("")}</tr>`).join("");
  res.setHeader("Content-Type", "application/vnd.ms-excel; charset=utf-8");
  res.setHeader("Content-Disposition", 'attachment; filename="asistenq-orders.xls"');
  res.send(`<!doctype html><html><head><meta charset="utf-8" /></head><body><table>${tableRows}</table></body></html>`);
});
app.post("/api/checkout", requireSession, async (req, res) => {
  if (req.user?.type !== "member") {
    res.status(403).json({ message: "member access required" });
    return;
  }
  try {
    const body = z.union([
      z.object({ productId: z.string().min(1) }),
      z.object({
        items: z.array(z.object({ productId: z.string().min(1), planId: z.string().min(1) })).min(1).max(25),
        voucherCode: z.string().trim().max(40).optional(),
        customerHwid: z.string().trim().regex(/^[A-Za-z0-9]{16}$/).optional()
      })
    ]).parse(req.body);
    const order = "items" in body ? await createCartCheckout(store, req.user.id, body) : await createCheckout(store, req.user.id, body.productId);
    void emailInvoice(order.id);
    res.status(201).json(publicOrder(order));
  } catch (error) {
    res.status(400).json({ message: error instanceof Error ? error.message : "Checkout gagal dibuat." });
  }
});
app.get("/api/member/orders", requireSession, (req, res) => {
  if (req.user?.type !== "member") {
    res.status(403).json({ message: "member access required" });
    return;
  }
  expirePendingOrders(store);
  void sendPendingOrderReminders();
  res.json(store.data.orders.filter((order) => order.memberId === req.user?.id).sort((left, right) => right.createdAt.localeCompare(left.createdAt)).map(publicOrder));
});
app.post("/api/member/orders/:id/hwid", requireSession, (req, res) => {
  if (req.user?.type !== "member") {
    res.status(403).json({ message: "member access required" });
    return;
  }
  try {
    const { hwid } = hwidOnlySchema.parse(req.body);
    const order = store.data.orders.find((item) => item.id === String(req.params.id) && item.memberId === req.user?.id);
    if (!order) throw new Error("Order tidak ditemukan.");
    if (order.status !== "paid") throw new Error("HWID dapat dimasukkan setelah pembayaran disetujui.");
    if (!order.orderItems?.some((item) => item.fulfillmentType === "license" && item.fulfillmentStatus !== "fulfilled")) {
      throw new Error("Pesanan ini tidak menunggu HWID lisensi.");
    }
    order.customerHwid = hwid.toUpperCase();
    fulfillPaidOrder(store, order.id);
    res.status(201).json(publicOrder(order));
  } catch (error) {
    const message2 = error instanceof z.ZodError ? error.issues.map((issue) => issue.message).join(", ") : error instanceof Error ? error.message : "HWID gagal disimpan.";
    res.status(400).json({ message: message2 });
  }
});
app.get("/api/member/products/:id/download", requireSession, (req, res) => {
  if (req.user?.type !== "member") {
    res.status(403).send("member access required");
    return;
  }
  const product = store.data.products.find((item) => item.id === String(req.params.id));
  const hasPaidOrder = store.data.orders.some((order) => order.memberId === req.user?.id && order.status === "paid" && (order.productId === product?.id || order.orderItems?.some((item) => item.productId === product?.id)));
  if (!product?.downloadSourceUrl || !hasPaidOrder) {
    res.status(404).send("download tidak tersedia");
    return;
  }
  res.redirect(product.downloadSourceUrl);
});
app.get("/api/member/orders/:id/invoice.html", requireSession, (req, res) => {
  if (req.user?.type !== "member") {
    res.status(403).send("member access required");
    return;
  }
  try {
    const html = formatInvoiceHtml(store, String(req.params.id), req.user.id);
    const order = store.data.orders.find((item) => item.id === String(req.params.id) || item.invoiceNumber === String(req.params.id));
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="${order?.invoiceNumber ?? req.params.id}.html"`);
    res.send(html);
  } catch {
    res.status(404).send("invoice not found");
  }
});
app.get("/api/member/licenses", requireSession, (req, res) => {
  if (req.user?.type !== "member") {
    res.status(403).json({ message: "member access required" });
    return;
  }
  res.json(memberLicenseDashboard(store, req.user.id));
});
app.post("/api/member/licenses/:id/reset-device", requireSession, (req, res) => {
  if (req.user?.type !== "member") {
    res.status(403).json({ message: "member access required" });
    return;
  }
  const body = z.object({ newHwid: z.string().min(8).max(32) }).parse(req.body);
  const member = store.data.members.find((item) => item.id === req.user?.id);
  const license = store.data.licenses.find((item) => item.id === String(req.params.id));
  if (!member || !license || license.email !== member.email) {
    res.status(404).json({ message: "Lisensi tidak ditemukan di akun member ini." });
    return;
  }
  res.json(resetLicenseDevice(store, { licenseId: license.id, newHwid: body.newHwid }));
});
app.use("/api", (error, _req, res, _next) => {
  const message2 = error instanceof z.ZodError ? error.issues.map((issue) => issue.message).join(", ") : error instanceof Error ? error.message : "Permintaan gagal diproses.";
  res.status(error instanceof z.ZodError ? 400 : 500).json({ message: message2 });
});
app.get("/tool-presence.js", (_req, res) => {
  res.type("application/javascript").send(`(() => {
    const script = document.currentScript;
    const productSlug = script?.dataset?.productSlug || '';
    const visitorKey = 'asistenq-visitor-id';
    const instanceKey = 'asistenq-tool-instance-id';
    const makeId = () => (globalThis.crypto?.randomUUID?.() || (Date.now().toString(36) + Math.random().toString(36).slice(2)));
    const visitorId = localStorage.getItem(visitorKey) || makeId();
    const instanceId = sessionStorage.getItem(instanceKey) || makeId();
    localStorage.setItem(visitorKey, visitorId);
    sessionStorage.setItem(instanceKey, instanceId);
    const post = (url, body) => fetch(url, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), keepalive: true
    }).catch(() => undefined);
    const heartbeat = () => post('/api/analytics/heartbeat', { visitorId, instanceId, productSlug });
    heartbeat();
    post('/api/analytics/event', { visitorId, productSlug, eventType: 'tool_open' });
    setInterval(heartbeat, 20000);
  })();`);
});
function sendTrackedHtml(res, indexPath, productSlug) {
  const source = fs8.readFileSync(indexPath, "utf8");
  const tracker = `<script src="/tool-presence.js" data-product-slug="${productSlug}"></script>`;
  const html = source.includes("</body>") ? source.replace("</body>", `${tracker}</body>`) : `${source}${tracker}`;
  res.type("html").send(html);
}
if (shouldServeFrontend) {
  app.use("/product-assets", express.static(productAssetDir));
  app.use("/landing-imports", express.static(landingImportDir));
  app.use("/landing-imports", express.static(bundledLandingDir));
  app.use((req, res, next) => {
    if (retiredLandingPaths.has(req.path)) {
      res.status(404).type("text/plain").send("Not Found");
      return;
    }
    for (const retiredPath of retiredLandingPaths) {
      if (req.path.startsWith(`${retiredPath}/`) || req.path === `/tools${retiredPath}` || req.path.startsWith(`/tools${retiredPath}/`)) {
        res.status(404).type("text/plain").send("Not Found");
        return;
      }
    }
    next();
  });
  app.get("/tools/:slug", (req, res, next) => {
    const product = store.data.products.find((item) => item.slug === req.params.slug);
    if (product && !canOpenProduct(req, product)) {
      sendProductAccessDenied(req, res, product);
      return;
    }
    const toolIndexPath = path8.join(bundledToolDir, req.params.slug, "index.html");
    if (product && fs8.existsSync(toolIndexPath)) {
      sendTrackedHtml(res, toolIndexPath, product.slug);
      return;
    }
    next();
  });
  app.use("/tools/:slug", (req, res, next) => {
    const product = store.data.products.find((item) => item.slug === req.params.slug);
    if (product && !canOpenProduct(req, product)) {
      sendProductAccessDenied(req, res, product);
      return;
    }
    express.static(path8.join(bundledToolDir, req.params.slug))(req, res, next);
  });
  app.get(/^\/[a-z0-9-]+$/, (req, res, next) => {
    const product = store.data.products.find((item) => item.landingPath === req.path || `/${item.slug}` === req.path);
    if (!product) {
      next();
      return;
    }
    if (product.landingTemplate === "tool-app") {
      if (!canOpenProduct(req, product)) {
        sendProductAccessDenied(req, res, product);
        return;
      }
      const toolIndexPath = path8.join(bundledToolDir, product.slug, "index.html");
      if (fs8.existsSync(toolIndexPath)) {
        sendTrackedHtml(res, toolIndexPath, product.slug);
        return;
      }
    }
    const importedIndexPath = path8.join(landingImportDir, product.slug, "index.html");
    const bundledIndexPath = path8.join(bundledLandingDir, product.slug, "index.html");
    const indexPath = fs8.existsSync(importedIndexPath) ? importedIndexPath : bundledIndexPath;
    if (!fs8.existsSync(indexPath)) {
      next();
      return;
    }
    sendTrackedHtml(res, indexPath, product.slug);
  });
  app.use(express.static(publicDir));
  app.get("*", (_req, res) => {
    res.sendFile(path8.join(publicDir, "index.html"));
  });
}
if (!isTest) {
  seedInitialData(store).then(() => {
    app.listen(port, () => {
      console.log(`AsistenQ running on port ${port}`);
    });
  });
}
export {
  app,
  store
};
