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

it('rejects a non-HTTPS download source', () => {
  expect(() => buildProductFulfillmentPatch('download', 'http://files.example.com/tool.zip')).toThrow('HTTPS');
});

it('does not require a download source for URL and course fulfillment', () => {
  expect(buildProductFulfillmentPatch('url', '')).toEqual({ fulfillmentType: 'url' });
  expect(buildProductFulfillmentPatch('course', '')).toEqual({ fulfillmentType: 'course' });
});
