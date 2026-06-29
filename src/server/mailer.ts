import net from 'node:net';
import tls from 'node:tls';

type MailInput = {
  to: string;
  subject: string;
  html: string;
  text?: string;
};

function configured() {
  return Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS && process.env.MAIL_FROM);
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
  const from = process.env.MAIL_FROM ?? '';
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

export async function sendMail(input: MailInput): Promise<{ sent: boolean; reason?: string }> {
  if (!configured()) {
    return { sent: false, reason: 'SMTP belum disetting.' };
  }

  const host = process.env.SMTP_HOST ?? '';
  const port = Number(process.env.SMTP_PORT ?? 587);
  const from = process.env.MAIL_FROM ?? '';
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
      await command(upgraded, Buffer.from(process.env.SMTP_USER ?? '').toString('base64'));
      await command(upgraded, Buffer.from(process.env.SMTP_PASS ?? '').toString('base64'));
      await command(upgraded, `MAIL FROM:<${from}>`);
      await command(upgraded, `RCPT TO:<${input.to}>`);
      await command(upgraded, 'DATA');
      await command(upgraded, message(input));
      await command(upgraded, 'QUIT');
      return { sent: true };
    }

    await command(socket, 'AUTH LOGIN');
    await command(socket, Buffer.from(process.env.SMTP_USER ?? '').toString('base64'));
    await command(socket, Buffer.from(process.env.SMTP_PASS ?? '').toString('base64'));
    await command(socket, `MAIL FROM:<${from}>`);
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
