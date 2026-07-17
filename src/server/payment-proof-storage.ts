import fs from 'node:fs';
import path from 'node:path';

export type PaymentProofCleanup = { files: number; bytes: number };

export function removePaymentProof(directory: string, storedName?: string): PaymentProofCleanup {
  const fileName = storedName ? path.basename(storedName) : '';
  if (!fileName) return { files: 0, bytes: 0 };
  const filePath = path.join(directory, fileName);
  if (!fs.existsSync(filePath)) return { files: 0, bytes: 0 };
  const stat = fs.statSync(filePath);
  if (!stat.isFile()) return { files: 0, bytes: 0 };
  fs.rmSync(filePath, { force: true });
  return { files: 1, bytes: stat.size };
}

export function clearPaymentProofDirectory(directory: string): PaymentProofCleanup {
  fs.mkdirSync(directory, { recursive: true });
  const result = { files: 0, bytes: 0 };
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    if (!entry.isFile()) continue;
    const removed = removePaymentProof(directory, entry.name);
    result.files += removed.files;
    result.bytes += removed.bytes;
  }
  return result;
}
