import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { saveProductMedia } from '../src/server/product-media-storage';

const roots: string[] = [];
afterEach(() => roots.splice(0).forEach((root) => fs.rmSync(root, { recursive: true, force: true })));

describe('product media storage', () => {
  it('stores allowlisted images below the product directory', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'asistenq-media-')); roots.push(root);
    const result = saveProductMedia({ root, productId: 'product_1', originalName: 'cover.JPG', mimeType: 'image/jpeg', buffer: Buffer.from('image') });
    expect(result.relativePath).toMatch(/^product_1\/[a-f0-9-]+\.jpg$/);
    expect(fs.existsSync(result.absolutePath)).toBe(true);
  });

  it('rejects traversal, mismatched types, and oversized images', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'asistenq-media-')); roots.push(root);
    expect(() => saveProductMedia({ root, productId: '../escape', originalName: 'x.jpg', mimeType: 'image/jpeg', buffer: Buffer.from('x') })).toThrow('product');
    expect(() => saveProductMedia({ root, productId: 'p', originalName: 'x.exe', mimeType: 'image/jpeg', buffer: Buffer.from('x') })).toThrow('tipe');
    expect(() => saveProductMedia({ root, productId: 'p', originalName: 'x.png', mimeType: 'image/png', buffer: Buffer.alloc(8 * 1024 * 1024 + 1) })).toThrow('ukuran');
  });
});
