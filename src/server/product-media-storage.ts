import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const allowed = new Map([
  ['image/jpeg', { extensions: ['.jpg', '.jpeg'], output: '.jpg', max: 8 * 1024 * 1024 }],
  ['image/png', { extensions: ['.png'], output: '.png', max: 8 * 1024 * 1024 }],
  ['image/webp', { extensions: ['.webp'], output: '.webp', max: 8 * 1024 * 1024 }],
  ['video/mp4', { extensions: ['.mp4'], output: '.mp4', max: 40 * 1024 * 1024 }],
  ['video/webm', { extensions: ['.webm'], output: '.webm', max: 40 * 1024 * 1024 }]
]);

export const productMediaRoot = path.resolve('data/product-media');

export function saveProductMedia(input: { root?: string; productId: string; originalName: string; mimeType: string; buffer: Buffer }) {
  if (!/^[A-Za-z0-9_-]+$/.test(input.productId)) throw new Error('product media id tidak valid');
  const rule = allowed.get(input.mimeType);
  const extension = path.extname(input.originalName).toLowerCase();
  if (!rule || !rule.extensions.includes(extension)) throw new Error('tipe file media tidak diizinkan');
  if (input.buffer.length > rule.max) throw new Error('ukuran file media terlalu besar');
  const root = path.resolve(input.root ?? productMediaRoot);
  const directory = path.join(root, input.productId);
  fs.mkdirSync(directory, { recursive: true });
  const fileName = `${crypto.randomUUID()}${rule.output}`;
  const absolutePath = path.join(directory, fileName);
  fs.writeFileSync(absolutePath, input.buffer, { flag: 'wx' });
  return { absolutePath, relativePath: `${input.productId}/${fileName}`, bytes: input.buffer.length, mimeType: input.mimeType };
}

export function removeProductMedia(relativePath: string, root = productMediaRoot): void {
  const base = path.resolve(root);
  const target = path.resolve(base, relativePath);
  if (!target.startsWith(base + path.sep)) throw new Error('path media tidak valid');
  fs.rmSync(target, { force: true });
}
