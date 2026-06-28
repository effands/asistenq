import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { spawn, type ChildProcess } from 'node:child_process';
import type { Store } from './store';

export type TelegramBotStatus = {
  configured: boolean;
  running: boolean;
  pid?: number;
  message: string;
};

type SpawnResult = Pick<ChildProcess, 'pid' | 'unref'>;

type BotControlOptions = {
  pidFile?: string;
  scriptPath?: string;
  isProcessAlive?: (pid: number) => boolean;
  spawnProcess?: (command: string, args: string[], options: {
    cwd: string;
    detached: boolean;
    stdio: 'ignore';
    env: NodeJS.ProcessEnv;
  }) => SpawnResult;
  killProcess?: (pid: number) => void;
};

const defaultPidFile = path.resolve('data/telegram-bot.pid');
const defaultScriptPath = path.resolve('integrations/python/telegram_license_bot.py');

function readPid(pidFile = defaultPidFile): number | undefined {
  try {
    const pid = Number(fs.readFileSync(pidFile, 'utf-8').trim());
    return Number.isInteger(pid) && pid > 0 ? pid : undefined;
  } catch {
    return undefined;
  }
}

function defaultIsProcessAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

function botMissingMessage(store: Store): string {
  const settings = store.data.deploymentSettings ?? {};
  const missing = [
    settings.telegramBotToken || process.env.TELEGRAM_BOT_TOKEN ? '' : 'Token Telegram',
    settings.telegramOwnerId || process.env.TELEGRAM_OWNER_ID ? '' : 'Owner ID'
  ].filter(Boolean);
  return missing.length ? `Belum lengkap: ${missing.join(', ')}.` : '';
}

function ensureBotSecret(store: Store): string {
  const current = store.data.deploymentSettings ?? {};
  if (current.botApiSecret) return current.botApiSecret;

  store.data.deploymentSettings = {
    githubRepo: current.githubRepo ?? 'effands/asistenq',
    githubBranch: current.githubBranch ?? 'master',
    ...current,
    botApiSecret: crypto.randomBytes(24).toString('hex'),
    updatedAt: new Date().toISOString()
  };
  store.save();
  return store.data.deploymentSettings.botApiSecret ?? '';
}

export function getTelegramBotStatus(store: Store, options: BotControlOptions = {}): TelegramBotStatus {
  const pidFile = options.pidFile ?? defaultPidFile;
  const isProcessAlive = options.isProcessAlive ?? defaultIsProcessAlive;
  const missing = botMissingMessage(store);
  const pid = readPid(pidFile);
  const running = Boolean(pid && isProcessAlive(pid));

  if (pid && !running) {
    fs.rmSync(pidFile, { force: true });
  }

  return {
    configured: !missing,
    running,
    ...(running && pid ? { pid } : {}),
    message: running ? 'Bot Telegram berjalan.' : missing || 'Bot Telegram belum jalan.'
  };
}

export function startTelegramBot(store: Store, options: BotControlOptions = {}): TelegramBotStatus {
  const pidFile = options.pidFile ?? defaultPidFile;
  const scriptPath = options.scriptPath ?? defaultScriptPath;
  const current = getTelegramBotStatus(store, options);
  if (!current.configured) return current;
  if (current.running) return current;
  if (!fs.existsSync(scriptPath)) {
    return { configured: true, running: false, message: 'File bot Python belum ditemukan.' };
  }

  const settings = store.data.deploymentSettings ?? {};
  const command = process.platform === 'win32' ? 'python' : 'python3';
  const botSecret = ensureBotSecret(store);
  const child = (options.spawnProcess ?? spawn)(command, [scriptPath], {
    cwd: process.cwd(),
    detached: true,
    stdio: 'ignore',
    env: {
      ...process.env,
      TELEGRAM_BOT_TOKEN: settings.telegramBotToken ?? process.env.TELEGRAM_BOT_TOKEN ?? '',
      TELEGRAM_OWNER_ID: settings.telegramOwnerId ?? process.env.TELEGRAM_OWNER_ID ?? '',
      ASISTENQ_BOT_SECRET: botSecret,
      ASISTENQ_API_BASE: process.env.ASISTENQ_API_BASE ?? (process.env.NODE_ENV === 'production' ? 'https://asistenq.com/api' : `http://127.0.0.1:${process.env.API_PORT ?? 4000}/api`)
    }
  });

  child.unref();
  fs.mkdirSync(path.dirname(pidFile), { recursive: true });
  fs.writeFileSync(pidFile, String(child.pid ?? ''), 'utf-8');

  return { configured: true, running: true, pid: child.pid, message: 'Bot Telegram berjalan.' };
}

export function stopTelegramBot(options: BotControlOptions = {}): TelegramBotStatus {
  const pidFile = options.pidFile ?? defaultPidFile;
  const pid = readPid(pidFile);
  if (pid) {
    try {
      (options.killProcess ?? ((targetPid: number) => process.kill(targetPid, 'SIGTERM')))(pid);
    } catch {
      // If the process is already gone, cleanup still matters.
    }
  }
  fs.rmSync(pidFile, { force: true });
  return { configured: true, running: false, message: pid ? 'Bot Telegram dihentikan.' : 'Bot Telegram belum jalan.' };
}
