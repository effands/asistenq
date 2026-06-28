import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { createMemoryStore } from '../src/server/store';
import { getTelegramBotStatus, startTelegramBot, stopTelegramBot } from '../src/server/bot-control';

describe('telegram bot control', () => {
  const tempFiles: string[] = [];

  afterEach(() => {
    for (const file of tempFiles.splice(0)) {
      fs.rmSync(file, { force: true });
    }
  });

  it('reports missing Telegram configuration before start', () => {
    const store = createMemoryStore();

    const status = getTelegramBotStatus(store, { isProcessAlive: () => false });

    expect(status.configured).toBe(false);
    expect(status.running).toBe(false);
    expect(status.message).toContain('Token Telegram');
  });

  it('starts a configured bot without exposing secrets', () => {
    const store = createMemoryStore({
      deploymentSettings: {
        githubRepo: 'effands/asistenq',
        githubBranch: 'master',
        telegramBotToken: '123456:SECRET_TOKEN',
        telegramOwnerId: '987654321'
      }
    });
    const pidFile = path.join(os.tmpdir(), `asistenq-bot-${Date.now()}.pid`);
    tempFiles.push(pidFile);

    const status = startTelegramBot(store, {
      pidFile,
      scriptPath: __filename,
      isProcessAlive: () => false,
      spawnProcess: (_command, _args, options) => {
        expect(options.env.TELEGRAM_BOT_TOKEN).toBe('123456:SECRET_TOKEN');
        expect(options.env.ASISTENQ_BOT_SECRET).toBeTruthy();
        return { pid: 24680, unref() {} };
      }
    });

    expect(status.running).toBe(true);
    expect(status.pid).toBe(24680);
    expect(status.message).toBe('Bot Telegram berjalan.');
    expect(store.data.deploymentSettings?.botApiSecret).toBeTruthy();
    expect(JSON.stringify(status)).not.toContain('SECRET_TOKEN');
  });

  it('stops a running bot and removes the pid file', () => {
    const store = createMemoryStore({
      deploymentSettings: {
        githubRepo: 'effands/asistenq',
        githubBranch: 'master',
        telegramBotToken: '123456:SECRET_TOKEN',
        telegramOwnerId: '987654321'
      }
    });
    const pidFile = path.join(os.tmpdir(), `asistenq-bot-stop-${Date.now()}.pid`);
    tempFiles.push(pidFile);
    fs.writeFileSync(pidFile, '13579', 'utf-8');
    let killedPid = 0;

    const status = stopTelegramBot({
      pidFile,
      killProcess: (pid) => {
        killedPid = pid;
      }
    });

    expect(killedPid).toBe(13579);
    expect(status.running).toBe(false);
    expect(status.message).toBe('Bot Telegram dihentikan.');
    expect(fs.existsSync(pidFile)).toBe(false);
  });
});
