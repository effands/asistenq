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
  passwordResets: [],
  products: [],
  plans: [],
  licenses: [],
  vouchers: [],
  announcements: [],
  bannedHwids: [],
  orders: [],
  subscriptions: [],
  auditLogs: [],
  deploymentSettings: {
    githubRepo: 'effands/asistenq',
    githubBranch: 'master'
  }
});

function normalizeData(data: Partial<DatabaseShape>): DatabaseShape {
  return {
    ...emptyData(),
    ...data,
    admins: data.admins ?? [],
    members: data.members ?? [],
    passwordResets: data.passwordResets ?? [],
    products: data.products ?? [],
    plans: data.plans ?? [],
    licenses: data.licenses ?? [],
    vouchers: data.vouchers ?? [],
    announcements: data.announcements ?? [],
    bannedHwids: data.bannedHwids ?? [],
    orders: data.orders ?? [],
    subscriptions: data.subscriptions ?? [],
    auditLogs: data.auditLogs ?? [],
    deploymentSettings: {
      githubRepo: 'effands/asistenq',
      githubBranch: 'master',
      ...(data.deploymentSettings ?? {})
    }
  };
}

export function createMemoryStore(initialData: Partial<DatabaseShape> = emptyData()): Store {
  return {
    data: structuredClone(normalizeData(initialData)),
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
    data: normalizeData(JSON.parse(fs.readFileSync(filePath, 'utf-8')) as Partial<DatabaseShape>),
    save() {
      fs.writeFileSync(filePath, JSON.stringify(this.data, null, 2));
    },
    reset() {
      this.data = emptyData();
      this.save();
    }
  };
}
