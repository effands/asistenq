import type { ProductFulfillmentType } from '../shared/types';

export function buildProductFulfillmentPatch(type: ProductFulfillmentType, sourceInput: string) {
  if (type !== 'download') return { fulfillmentType: type };
  const downloadSourceUrl = sourceInput.trim();
  if (!downloadSourceUrl.startsWith('https://')) throw new Error('URL download harus HTTPS.');
  return { fulfillmentType: type, downloadSourceUrl };
}

export function cleanOptionalProductUrls<T extends { demoUrl?: string; documentationUrl?: string; externalUrl?: string }>(input: T): T {
  return {
    ...input,
    demoUrl: input.demoUrl?.trim() || undefined,
    documentationUrl: input.documentationUrl?.trim() || undefined,
    externalUrl: input.externalUrl?.trim() || undefined
  };
}
