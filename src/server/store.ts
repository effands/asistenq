import fs from 'node:fs';
import path from 'node:path';
import type { DatabaseShape } from '../shared/types';

export interface Store {
  data: DatabaseShape;
  save(): void;
  reset(): void;
}

const emptyData = (): DatabaseShape => ({
  admins: [],
  members: [],
  products: [],
  orders: [],
  subscriptions: [],
  auditLogs: []
});

export function createMemoryStore(initialData: DatabaseShape = emptyData()): Store {
  return {
    data: structuredClone(initialData),
    save() {},
    reset() {
      this.data = emptyData();
    }
  };
}

export function createFileStore(filePath = path.resolve('data/asistenq.json')): Store {
  const dir = path.dirname(filePath);

  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  if (!fs.existsSync(filePath)) {
    fs.writeFileSync(filePath, JSON.stringify(emptyData(), null, 2));
  }

  return {
    data: JSON.parse(fs.readFileSync(filePath, 'utf-8')) as DatabaseShape,
    save() {
      fs.writeFileSync(filePath, JSON.stringify(this.data, null, 2));
    },
    reset() {
      this.data = emptyData();
      this.save();
    }
  };
}
