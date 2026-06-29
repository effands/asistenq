import net from 'node:net';
import tls from 'node:tls';
import fs from 'node:fs';
import path from 'node:path';
import type { DeploymentSettings } from '../shared/types';

type MailInput = {
  to: string;
  subject: string;
  html: string;
  text?: string;
};

type MailSettings = {
  SMTP_HOST?: string;
  SMTP_PORT?: string;
  SMTP_USER?: string;
  SMTP_PASS?: string;
  MAIL_FROM?: string;
};

function readMailSettings(): MailSettings {
  try {
    const filePath = path.resolve('data/mail-settings.json');
    return JSON.parse(fs.readFileSync(filePath, 'utf-8')) as MailSettings;
  } catch {
    return {};
  }
}

function readDeploymentMailSettings(): Partial<DeploymentSettings> {
  try {
    const filePath = path.resolve('data/asistenq.json');
    const data = JSON.parse(fs.readFileSync(filePath, 'utf-8')) as { deploymentSettings?: DeploymentSettings };
    return data.deploymentSettings ?? {};
  } catch {
    return {};
  }
}

export function resolveMailSettings(
  env: NodeJS.ProcessEnv,
  file: MailSettings,
  admin: Partial<DeploymentSettings>
): MailSettings {
  return {
    SMTP_HOST: env.SMTP_HOST || admin.smtpHost || file.SMTP_HOST,
    SMTP_PORT: env.SMTP_PORT || admin.smtpPort || file.SMTP_PORT,
    SMTP_USER: env.SMTP_USER || admin.smtpUser || file.SMTP_USER,
    SMTP_PASS: env.SMTP_PASS || admin.smtpPass || file.SMTP_PASS,
    MAIL_FROM: env.MAIL_FROM || admin.mailFrom || file.MAIL_FROM
  };
}

function settings(): MailSettings {
  const file = readMailSettings();
  return resolveMailSettings(process.env, file, readDeploymentMailSettings());
}

function configured(mailSettings: MailSettings) {
  return Boolean(mailSettings.SMTP_HOST && mailSettings.SMTP_USER && mailSettings.SMTP_PASS && mailSettings.MAIL_FROM);
}

function readLine(socket: net.Socket): Promise<string> {
  return new Promise((resolve, reject) => {
    let buffer = '';
    const onData = (chunk: Buffer) => {
      buffer += chunk.toString('utf8');
      if (buffer.includes('\n')) {
        socket.off('data', onData);
        resolve(buffer);
      }
    };
    socket.once('error', reject);
    socket.on('data', onData);
  });
}

async function command(socket: net.Socket, text: string): Promise<string> {
  socket.write(`${text}\r\n`);
  return readLine(socket);
}

function message(input: MailInput): string {
  const from = settings().MAIL_FROM ?? '';
  const boundary = `asistenq-${Date.now()}`;
  const text = input.text ?? input.html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();

  return [
    `From: ${from}`,
    `To: ${input.to}`,
    `Subject: ${input.subject}`,
    'MIME-Version: 1.0',
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
    '',
    `--${boundary}`,
    'Content-Type: text/plain; charset=utf-8',
    '',
    text,
    `--${boundary}`,
    'Content-Type: text/html; charset=utf-8',
    '',
    input.html,
    `--${boundary}--`,
    '.'
  ].join('\r\n');
}

function senderAddress(from: string): string {
  const match = from.match(/<([^>]+)>/);
  return (match?.[1] ?? from).trim();
}

export async function sendMail(input: MailInput): Promise<{ sent: boolean; reason?: string }> {
  const mailSettings = settings();
  if (!configured(mailSettings)) {
    return { sent: false, reason: 'SMTP belum disetting.' };
  }

  const host = mailSettings.SMTP_HOST ?? '';
  const port = Number(mailSettings.SMTP_PORT ?? 587);
  const from = mailSettings.MAIL_FROM ?? '';
  const envelopeFrom = senderAddress(from);
  const secure = port === 465;
  const socket = secure
    ? tls.connect({ host, port, servername: host })
    : net.connect({ host, port });

  try {
    await readLine(socket);
    await command(socket, `EHLO asistenq.com`);
    if (!secure) {
      await command(socket, 'STARTTLS');
      const upgraded = tls.connect({ socket, servername: host });
      await command(upgraded, `EHLO asistenq.com`);
      await command(upgraded, 'AUTH LOGIN');
      await command(upgraded, Buffer.from(mailSettings.SMTP_USER ?? '').toString('base64'));
      await command(upgraded, Buffer.from(mailSettings.SMTP_PASS ?? '').toString('base64'));
      await command(upgraded, `MAIL FROM:<${envelopeFrom}>`);
      await command(upgraded, `RCPT TO:<${input.to}>`);
      await command(upgraded, 'DATA');
      await command(upgraded, message(input));
      await command(upgraded, 'QUIT');
      return { sent: true };
    }

    await command(socket, 'AUTH LOGIN');
    await command(socket, Buffer.from(mailSettings.SMTP_USER ?? '').toString('base64'));
    await command(socket, Buffer.from(mailSettings.SMTP_PASS ?? '').toString('base64'));
    await command(socket, `MAIL FROM:<${envelopeFrom}>`);
    await command(socket, `RCPT TO:<${input.to}>`);
    await command(socket, 'DATA');
    await command(socket, message(input));
    await command(socket, 'QUIT');
    return { sent: true };
  } catch (error) {
    return { sent: false, reason: error instanceof Error ? error.message : 'Email gagal dikirim.' };
  } finally {
    socket.destroy();
  }
}
