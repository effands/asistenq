import fs from 'node:fs';
import path from 'node:path';
import type { Order } from '../shared/types';
import { formatCurrency } from '../shared/domain';
import type { Store } from './store';

export type PaymentProofNotificationInput = {
  invoice: string;
  buyer: string;
  product: string;
  plan: string;
  total: string;
  source: string;
};

type TelegramButton = { text: string; callback_data?: string; url?: string };

export function buildPaymentProofNotification(input: PaymentProofNotificationInput, adminUrl: string) {
  return {
    caption: [
      '🧾 Bukti pembayaran baru',
      `Invoice: ${input.invoice}`,
      `Pembeli: ${input.buyer}`,
      `Produk: ${input.product}`,
      `Paket: ${input.plan}`,
      `Total: ${input.total}`,
      `Sumber: ${input.source}`
    ].join('\n'),
    reply_markup: {
      inline_keyboard: [
        [
          { text: '✅ Setujui', callback_data: `proof_ok:${input.invoice}` },
          { text: '❌ Tolak', callback_data: `proof_no:${input.invoice}` }
        ],
        [
          { text: '🔍 Detail', callback_data: `order:${input.invoice}` },
          { text: '🌐 Buka Admin Web', url: adminUrl }
        ]
      ] as TelegramButton[][]
    }
  };
}

export async function notifyOwnerOfPaymentProof(
  store: Store,
  order: Order,
  filePath: string,
  source: string,
  fetcher: typeof fetch = fetch
): Promise<{ delivered: boolean; error?: string }> {
  const settings = store.data.deploymentSettings ?? {};
  const token = settings.telegramBotToken ?? process.env.TELEGRAM_BOT_TOKEN ?? '';
  const ownerId = settings.telegramOwnerId ?? process.env.TELEGRAM_OWNER_ID ?? '';
  if (!token || !ownerId) return { delivered: false, error: 'Telegram owner belum dikonfigurasi.' };

  const product = store.data.products.find((item) => item.id === order.productId);
  const plan = store.data.plans.find((item) => item.id === order.planId);
  const member = store.data.members.find((item) => item.id === order.memberId);
  const invoice = order.invoiceNumber ?? order.id;
  const notification = buildPaymentProofNotification({
    invoice,
    buyer: `${member?.name ?? order.customerEmail ?? 'Pembeli'} <${order.customerEmail ?? member?.email ?? '-'}>`,
    product: product?.name ?? order.productName ?? order.productId,
    plan: plan?.name ?? '-',
    total: formatCurrency(order.totalAmount ?? order.amount),
    source
  }, `https://asistenq.com/?adminOrder=${encodeURIComponent(invoice)}`);

  try {
    const form = new FormData();
    form.set('chat_id', ownerId);
    form.set('caption', notification.caption);
    form.set('reply_markup', JSON.stringify(notification.reply_markup));
    form.set('photo', new Blob([fs.readFileSync(filePath)]), path.basename(filePath));
    const response = await fetcher(`https://api.telegram.org/bot${token}/sendPhoto`, { method: 'POST', body: form });
    if (!response.ok) throw new Error(`Telegram HTTP ${response.status}`);
    return { delivered: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Telegram notification failed';
    console.error(`Payment proof notification failed for ${invoice}: ${message}`);
    return { delivered: false, error: message };
  }
}
