import type { ProductFulfillmentType } from '../shared/types';

export function buildProductFulfillmentPatch(type: ProductFulfillmentType, sourceInput: string) {
  if (type === 'license') return { fulfillmentType: type };
  const downloadSourceUrl = sourceInput.trim();
  if (!downloadSourceUrl.startsWith('https://')) throw new Error('URL download harus HTTPS.');
  return { fulfillmentType: type, downloadSourceUrl };
}
