import crypto from 'node:crypto';
import QRCode from 'qrcode';
import type { DeploymentSettings, Order, OrderItem } from '../shared/types';

export interface SakuRupiahCreateInvoiceInput {
  apiId: string;
  apiKey: string;
  isSandbox?: boolean;
  method?: string;
  merchantRef: string;
  amount: number;
  customerName?: string;
  customerEmail?: string;
  customerPhone?: string;
  merchantFee?: number; // 1 = Merchant, 2 = Customer
  expiredHours?: number;
  callbackUrl: string;
  returnUrl: string;
  items?: OrderItem[];
}

export interface SakuRupiahCreateInvoiceResult {
  success: boolean;
  trxId?: string;
  merchantRef?: string;
  qrPayload?: string;
  qrDataUrl?: string;
  checkoutUrl?: string;
  paymentNo?: string;
  via?: string;
  expiredAt?: string;
  message?: string;
}

export interface SakuRupiahCallbackPayload {
  trx_id: string;
  merchant_ref: string;
  status: string; // 'berhasil' | 'expired' | 'pending'
  status_kode: number; // 1 = berhasil, 2 = expired, 0 = pending
  amount?: number | string;
}

export function buildSakuRupiahSignature(input: {
  apiId: string;
  method: string;
  merchantRef: string;
  amount: number | string;
  apiKey: string;
}): string {
  const payload = `${input.apiId}${input.method}${input.merchantRef}${input.amount}`;
  return crypto.createHmac('sha256', input.apiKey).update(payload).digest('hex');
}

export function verifySakuRupiahCallbackSignature(
  rawJsonBody: string,
  headerSignature: string,
  apiKey: string
): boolean {
  if (!headerSignature || !apiKey || !rawJsonBody) return false;
  const expectedSignature = crypto.createHmac('sha256', apiKey).update(rawJsonBody).digest('hex');
  const left = Buffer.from(headerSignature.toLowerCase(), 'hex');
  const right = Buffer.from(expectedSignature.toLowerCase(), 'hex');
  if (left.length !== right.length) return false;
  return crypto.timingSafeEqual(left, right);
}

export async function createSakuRupiahInvoice(
  settings: DeploymentSettings,
  order: Order,
  items: OrderItem[] = [],
  callbackUrl: string,
  returnUrl: string
): Promise<SakuRupiahCreateInvoiceResult> {
  const apiId = settings.sakuRupiahApiId?.trim();
  const apiKey = settings.sakuRupiahApiKey?.trim();
  const isSandbox = settings.sakuRupiahMode === 'sandbox' || !settings.sakuRupiahMode;
  const method = settings.sakuRupiahMethod?.trim() || 'QRIS';
  const merchantFee = settings.sakuRupiahMerchantFee ?? 1;

  if (!apiId || !apiKey) {
    throw new Error('SakuRupiah API ID dan API Key belum dikonfigurasi');
  }

  const baseUrl = isSandbox ? 'https://sakurupiah.id/api-sanbox/' : 'https://sakurupiah.id/api/';
  const createUrl = `${baseUrl}create.php`;

  const amount = order.totalAmount ?? order.amount;
  const merchantRef = order.invoiceNumber ?? order.id;
  const customerName = order.customerEmail?.split('@')[0] || 'Pelanggan AsistenQ';
  const customerEmail = order.customerEmail || 'buyer@asistenq.com';
  const customerPhone = '081234567890'; // Default phone if omitted

  const signature = buildSakuRupiahSignature({
    apiId,
    method,
    merchantRef,
    amount,
    apiKey
  });

  const formParams = new URLSearchParams();
  formParams.append('api_id', apiId);
  formParams.append('method', method);
  formParams.append('name', customerName);
  formParams.append('email', customerEmail);
  formParams.append('phone', customerPhone);
  formParams.append('amount', String(amount));
  formParams.append('merchant_fee', String(merchantFee));
  formParams.append('merchant_ref', merchantRef);
  formParams.append('expired', '24');
  formParams.append('callback_url', callbackUrl);
  formParams.append('return_url', returnUrl);
  formParams.append('signature', signature);

  if (items.length > 0) {
    items.forEach((item) => {
      formParams.append('produk[]', item.productName);
      formParams.append('qty[]', '1');
      formParams.append('harga[]', String(item.unitAmount));
    });
  }

  const response = await fetch(createUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: `Bearer ${apiKey}`
    },
    body: formParams.toString()
  });

  const rawText = await response.text();
  let json: any;
  try {
    json = JSON.parse(rawText);
  } catch {
    throw new Error(`Respon SakuRupiah tidak valid: ${rawText.slice(0, 100)}`);
  }

  if (String(json.status) !== '200' || !Array.isArray(json.data) || json.data.length === 0) {
    const errorMsg = json.message || json.detail || 'Gagal membuat invoice SakuRupiah';
    throw new Error(errorMsg);
  }

  const data = json.data[0];
  const qrPayload = data.qr || '';
  let qrDataUrl: string | undefined;

  if (qrPayload) {
    try {
      qrDataUrl = await QRCode.toDataURL(qrPayload, {
        errorCorrectionLevel: 'M',
        margin: 2,
        width: 320
      });
    } catch {
      // Fallback if QRCode generation fails
    }
  }

  return {
    success: true,
    trxId: data.trx_id,
    merchantRef: data.merchant_ref,
    qrPayload,
    qrDataUrl,
    checkoutUrl: data.checkout_url,
    paymentNo: data.payment_no ? String(data.payment_no) : undefined,
    via: data.via,
    expiredAt: data.expired
  };
}

export async function checkSakuRupiahBalance(settings: DeploymentSettings): Promise<{
  merchantName: string;
  balance: string;
  availableBalance: string;
}> {
  const apiId = settings.sakuRupiahApiId?.trim();
  const apiKey = settings.sakuRupiahApiKey?.trim();
  const isSandbox = settings.sakuRupiahMode === 'sandbox' || !settings.sakuRupiahMode;

  if (!apiId || !apiKey) {
    throw new Error('SakuRupiah API ID dan API Key belum dikonfigurasi');
  }

  const baseUrl = isSandbox ? 'https://sakurupiah.id/api-sanbox/' : 'https://sakurupiah.id/api/';
  const url = `${baseUrl}check_balance.php`;

  const formParams = new URLSearchParams();
  formParams.append('api_id', apiId);
  formParams.append('method', 'balance');

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: `Bearer ${apiKey}`
    },
    body: formParams.toString()
  });

  const json: any = await response.json();
  if (String(json.status) !== '200' || !json.data) {
    throw new Error(json.message || 'Gagal mengecek saldo SakuRupiah');
  }

  return {
    merchantName: json.data.nama_merchant || 'Merchant',
    balance: json.data.balance || '0',
    availableBalance: json.data.saldo_tersedia || '0'
  };
}
