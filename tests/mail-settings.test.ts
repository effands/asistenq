import { describe, expect, it } from 'vitest';
import { resolveMailSettings } from '../src/server/mailer';

describe('mail settings resolver', () => {
  it('uses admin SMTP settings when environment values are empty', () => {
    const result = resolveMailSettings(
      {},
      {},
      {
        smtpHost: 'mail.asistenq.com',
        smtpPort: '465',
        smtpUser: 'cs@asistenq.com',
        smtpPass: 'secret-password',
        mailFrom: 'AsistenQ <cs@asistenq.com>'
      }
    );

    expect(result).toEqual({
      SMTP_HOST: 'mail.asistenq.com',
      SMTP_PORT: '465',
      SMTP_USER: 'cs@asistenq.com',
      SMTP_PASS: 'secret-password',
      MAIL_FROM: 'AsistenQ <cs@asistenq.com>'
    });
  });

  it('keeps environment SMTP values as the highest priority', () => {
    const result = resolveMailSettings(
      { SMTP_HOST: 'smtp.env.test', SMTP_USER: 'env-user', SMTP_PASS: 'env-pass', MAIL_FROM: 'Env <env@test>' },
      { SMTP_HOST: 'smtp.file.test', SMTP_PORT: '587' },
      { smtpHost: 'mail.asistenq.com' }
    );

    expect(result.SMTP_HOST).toBe('smtp.env.test');
    expect(result.SMTP_PORT).toBe('587');
    expect(result.SMTP_USER).toBe('env-user');
    expect(result.SMTP_PASS).toBe('env-pass');
    expect(result.MAIL_FROM).toBe('Env <env@test>');
  });

  it('prefers admin SMTP settings over the legacy mail settings file', () => {
    const result = resolveMailSettings(
      {},
      {
        SMTP_HOST: 'legacy-host',
        SMTP_PORT: '587',
        SMTP_USER: 'legacy-user',
        SMTP_PASS: 'legacy-pass',
        MAIL_FROM: 'Legacy <legacy@test>'
      },
      {
        smtpHost: 'mail.asistenq.com',
        smtpPort: '465',
        smtpUser: 'cs@asistenq.com',
        smtpPass: 'admin-pass',
        mailFrom: 'AsistenQ <cs@asistenq.com>'
      }
    );

    expect(result.SMTP_HOST).toBe('mail.asistenq.com');
    expect(result.SMTP_PORT).toBe('465');
    expect(result.SMTP_USER).toBe('cs@asistenq.com');
    expect(result.SMTP_PASS).toBe('admin-pass');
    expect(result.MAIL_FROM).toBe('AsistenQ <cs@asistenq.com>');
  });
});
