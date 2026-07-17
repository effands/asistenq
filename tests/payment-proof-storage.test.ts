import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { clearPaymentProofDirectory, removePaymentProof } from '../src/server/payment-proof-storage';

const directories: string[] = [];

function temporaryDirectory() {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'asistenq-proof-'));
  directories.push(directory);
  return directory;
}

afterEach(() => {
  for (const directory of directories.splice(0)) fs.rmSync(directory, { recursive: true, force: true });
});

describe('payment proof storage', () => {
  it('removes only the basename and reports bytes', () => {
    const directory = temporaryDirectory();
    fs.writeFileSync(path.join(directory, 'proof.png'), Buffer.from('test'));

    expect(removePaymentProof(directory, '../proof.png')).toEqual({ files: 1, bytes: 4 });
    expect(removePaymentProof(directory, 'proof.png')).toEqual({ files: 0, bytes: 0 });
  });

  it('clears regular files and reports their total size', () => {
    const directory = temporaryDirectory();
    fs.writeFileSync(path.join(directory, 'one.png'), Buffer.from('abc'));
    fs.writeFileSync(path.join(directory, 'two.jpg'), Buffer.from('test'));
    fs.mkdirSync(path.join(directory, 'keep-directory'));

    expect(clearPaymentProofDirectory(directory)).toEqual({ files: 2, bytes: 7 });
    expect(fs.existsSync(path.join(directory, 'keep-directory'))).toBe(true);
  });
});
