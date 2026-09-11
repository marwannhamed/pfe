import { Injectable, Logger } from '@nestjs/common';
import { MailerService } from '@nestjs-modules/mailer';
import { ConfigService } from '@nestjs/config';
import { BrevoService } from '../brevo/brevo.service';
import { compileMailTemplate } from './mail-template.util';

export interface DeliverMailOptions {
  to: string;
  subject: string;
  html?: string;
  text?: string;
  template?: string;
  context?: Record<string, unknown>;
}

export interface DeliverMailResult {
  ok: boolean;
  provider: 'brevo' | 'smtp' | 'console' | 'none';
  error?: string;
  messageId?: string;
}

type MailProvider = 'auto' | 'brevo' | 'smtp';

@Injectable()
export class MailDeliveryService {
  private readonly logger = new Logger(MailDeliveryService.name);

  constructor(
    private readonly mailer: MailerService,
    private readonly brevo: BrevoService,
    private readonly config: ConfigService,
  ) {}

  isConfigured(): boolean {
    return this.brevo.isConfigured() || this.isSmtpConfigured();
  }

  private getProviderMode(): MailProvider {
    const raw = this.config.get<string>('MAIL_PROVIDER')?.trim().toLowerCase();
    if (raw === 'brevo' || raw === 'smtp' || raw === 'auto') return raw;
    return 'auto';
  }

  /** In dev, prefer Mailtrap SMTP when configured so emails appear in the Mailtrap inbox. */
  private preferSmtpFirst(): boolean {
    const mode = this.getProviderMode();
    if (mode === 'smtp') return true;
    if (mode === 'brevo') return false;

    const host = this.config.get<string>('MAIL_HOST')?.toLowerCase() ?? '';
    const isDev =
      (this.config.get<string>('NODE_ENV') ?? 'development') !== 'production';
    if (isDev && host.includes('mailtrap')) {
      return true;
    }
    return false;
  }

  getStatus() {
    const mode = this.getProviderMode();
    const preferSmtp = this.preferSmtpFirst();
    return {
      brevo: this.brevo.isConfigured(),
      smtp: this.isSmtpConfigured(),
      from: this.getFromAddress(),
      provider: mode,
      active:
        preferSmtp && this.isSmtpConfigured()
          ? 'smtp'
          : this.brevo.isConfigured()
            ? 'brevo'
            : this.isSmtpConfigured()
              ? 'smtp'
              : 'console',
      hint:
        preferSmtp && this.isSmtpConfigured()
          ? 'Using Mailtrap/SMTP — check your Mailtrap inbox'
          : this.brevo.isConfigured()
            ? 'Using Brevo — check Brevo → Transactional → Logs (not Mailtrap)'
            : 'Not configured',
    };
  }

  private isSmtpConfigured(): boolean {
    const host = this.config.get<string>('MAIL_HOST')?.trim();
    const user = this.config.get<string>('MAIL_USER')?.trim();
    const pass = this.config.get<string>('MAIL_PASSWORD')?.trim();
    if (!host || !user || !pass) return false;
    if (user === 'your-email@gmail.com' || pass === 'your-app-password')
      return false;
    return true;
  }

  private getFromAddress(): string {
    const name =
      this.config.get<string>('MAIL_FROM_NAME')?.trim() || 'LeaseManager';
    const email =
      this.config.get<string>('MAIL_FROM')?.trim() ||
      'noreply@leasemanager.com';
    return `"${name}" <${email}>`;
  }

  async deliver(options: DeliverMailOptions): Promise<DeliverMailResult> {
    const { to, subject, text, template, context } = options;
    let html = options.html;

    if (template) {
      try {
        html = compileMailTemplate(template, context ?? {});
      } catch (err: any) {
        const message = err?.message ?? String(err);
        this.logger.error(`Template compile failed (${template}): ${message}`);
        return { ok: false, provider: 'none', error: message };
      }
    }

    const htmlBody = html ?? (text ? `<pre>${text}</pre>` : '<p></p>');
    const payload = { to, subject, html: htmlBody, text };

    if (this.preferSmtpFirst() && this.isSmtpConfigured()) {
      const smtp = await this.deliverViaSmtp(payload);
      if (smtp.ok) return smtp;
      this.logger.warn(`SMTP failed for ${to}, trying Brevo fallback`);
    }

    if (this.brevo.isConfigured()) {
      const result = await this.brevo.sendHtmlEmail({
        toEmail: to,
        subject,
        htmlContent: htmlBody,
        textContent: text,
      });
      if (result.ok) {
        this.logger.log(`Email sent via Brevo to ${to}: ${subject}`);
        return { ok: true, provider: 'brevo', messageId: result.messageId };
      }
      this.logger.warn(`Brevo failed for ${to}, falling back to SMTP`);
    }

    if (!this.preferSmtpFirst() && this.isSmtpConfigured()) {
      return this.deliverViaSmtp(payload);
    }

    this.logger.warn(
      `[MAIL — not configured] To: ${to} | Subject: ${subject}\n` +
        (text ?? htmlBody.replace(/<[^>]+>/g, ' ').slice(0, 800)),
    );
    return {
      ok: false,
      provider: 'console',
      error:
        'Mail not configured (set BREVO_API_KEY or MAIL_HOST/MAIL_USER/MAIL_PASSWORD)',
    };
  }

  private async deliverViaSmtp(
    options: DeliverMailOptions & { html: string },
  ): Promise<DeliverMailResult> {
    try {
      await this.mailer.sendMail({
        to: options.to,
        from: this.getFromAddress(),
        subject: options.subject,
        html: options.html,
        text: options.text,
      });
      this.logger.log(
        `Email sent via SMTP to ${options.to}: ${options.subject}`,
      );
      return { ok: true, provider: 'smtp' };
    } catch (err: any) {
      const message = err?.message ?? String(err);
      this.logger.error(`SMTP send failed to ${options.to}: ${message}`);
      return { ok: false, provider: 'smtp', error: message };
    }
  }
}
