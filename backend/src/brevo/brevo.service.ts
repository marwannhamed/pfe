import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

const BREVO_API_BASE = 'https://api.brevo.com/v3';

interface BrevoSender {
  email: string;
  name: string;
  active: boolean;
}

@Injectable()
export class BrevoService {
  private readonly logger = new Logger(BrevoService.name);
  private readonly apiKey: string | undefined;
  private verifiedSenders: BrevoSender[] | null = null;

  constructor(private readonly config: ConfigService) {
    this.apiKey = this.config.get<string>('BREVO_API_KEY')?.trim() || undefined;
  }

  isConfigured(): boolean {
    return !!this.apiKey;
  }

  private headers(): Record<string, string> {
    return {
      accept: 'application/json',
      'content-type': 'application/json',
      'api-key': this.apiKey!,
    };
  }

  /** Verified senders from the Brevo dashboard (cached). */
  async getVerifiedSenders(): Promise<BrevoSender[]> {
    if (!this.isConfigured()) return [];
    if (this.verifiedSenders) return this.verifiedSenders;

    try {
      const res = await fetch(`${BREVO_API_BASE}/senders`, {
        headers: this.headers(),
      });
      if (!res.ok) {
        const text = await res.text();
        this.logger.warn(`Brevo list senders failed: ${res.status} ${text}`);
        return [];
      }
      const data = (await res.json()) as {
        senders?: Array<{ email: string; name: string; active: boolean }>;
      };
      this.verifiedSenders = (data.senders ?? [])
        .filter((s) => s.active)
        .map((s) => ({ email: s.email, name: s.name, active: s.active }));
      return this.verifiedSenders;
    } catch (err: any) {
      this.logger.warn(`Brevo list senders error: ${err?.message ?? err}`);
      return [];
    }
  }

  /** Use MAIL_FROM when verified in Brevo; otherwise first active dashboard sender. */
  async resolveSender(): Promise<{ email: string; name: string }> {
    const preferredEmail = this.config.get<string>('MAIL_FROM')?.trim();
    const preferredName =
      this.config.get<string>('MAIL_FROM_NAME')?.trim() || 'LeaseManager';

    const verified = await this.getVerifiedSenders();
    if (preferredEmail) {
      const match = verified.find(
        (s) => s.email.toLowerCase() === preferredEmail.toLowerCase(),
      );
      if (match) {
        return { email: match.email, name: preferredName || match.name };
      }
      if (verified.length > 0) {
        this.logger.warn(
          `MAIL_FROM (${preferredEmail}) is not a verified Brevo sender — using ${verified[0].email} instead. ` +
            `Add/verify the sender in Brevo → Senders, or set MAIL_FROM=${verified[0].email}`,
        );
        return { email: verified[0].email, name: preferredName || verified[0].name };
      }
      this.logger.warn(
        `MAIL_FROM (${preferredEmail}) is not verified in Brevo and no senders found — delivery may fail`,
      );
      return { email: preferredEmail, name: preferredName };
    }

    if (verified.length > 0) {
      return { email: verified[0].email, name: preferredName || verified[0].name };
    }

    return { email: 'noreply@leasemanager.com', name: preferredName };
  }

  /**
   * Create or update a Brevo contact; returns string id for storage on Tenant.brevo_contact_id.
   */
  async createOrUpdateContact(input: {
    email: string;
    firstName?: string | null;
    lastName?: string | null;
    companyName?: string | null;
  }): Promise<string | null> {
    if (!this.isConfigured()) return null;

    const body = {
      email: input.email,
      updateEnabled: true,
      attributes: {
        ...(input.firstName && { FIRSTNAME: input.firstName }),
        ...(input.lastName && { LASTNAME: input.lastName }),
        ...(input.companyName && { COMPANY: input.companyName }),
      },
    };

    const res = await fetch(`${BREVO_API_BASE}/contacts`, {
      method: 'POST',
      headers: this.headers(),
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const text = await res.text();
      this.logger.warn(`Brevo createOrUpdateContact failed: ${res.status} ${text}`);
      return null;
    }

    const data = (await res.json()) as { id?: number };
    return data.id != null ? String(data.id) : null;
  }

  /**
   * Send a transactional email using a template configured in the Brevo dashboard.
   */
  async sendTransactionalEmail(input: {
    templateId: number;
    toEmail: string;
    toName?: string | null;
    params?: Record<string, string | number | boolean | null | undefined>;
  }): Promise<boolean> {
    if (!this.isConfigured()) return false;

    const params: Record<string, string | number | boolean> = {};
    if (input.params) {
      for (const [k, v] of Object.entries(input.params)) {
        if (v === null || v === undefined) continue;
        params[k] = v as string | number | boolean;
      }
    }

    const body = {
      to: [{ email: input.toEmail, name: input.toName ?? undefined }],
      templateId: input.templateId,
      params,
    };

    const res = await fetch(`${BREVO_API_BASE}/smtp/email`, {
      method: 'POST',
      headers: this.headers(),
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const text = await res.text();
      this.logger.warn(`Brevo sendTransactionalEmail failed: ${res.status} ${text}`);
      return false;
    }

    return true;
  }

  /** Send HTML email without a Brevo dashboard template (transactional API). */
  async sendHtmlEmail(input: {
    toEmail: string;
    toName?: string | null;
    subject: string;
    htmlContent: string;
    textContent?: string;
  }): Promise<{ ok: boolean; messageId?: string; error?: string }> {
    if (!this.isConfigured()) return { ok: false, error: 'Brevo not configured' };

    const sender = await this.resolveSender();

    const body = {
      sender: { name: sender.name, email: sender.email },
      to: [{ email: input.toEmail, name: input.toName ?? undefined }],
      subject: input.subject,
      htmlContent: input.htmlContent,
      ...(input.textContent ? { textContent: input.textContent } : {}),
    };

    const res = await fetch(`${BREVO_API_BASE}/smtp/email`, {
      method: 'POST',
      headers: this.headers(),
      body: JSON.stringify(body),
    });

    const text = await res.text();
    if (!res.ok) {
      this.logger.warn(`Brevo sendHtmlEmail failed: ${res.status} ${text}`);
      return { ok: false, error: text };
    }

    let messageId: string | undefined;
    try {
      messageId = JSON.parse(text)?.messageId;
    } catch {
      /* ignore */
    }
    if (messageId) {
      this.logger.log(`Brevo messageId: ${messageId} → ${input.toEmail}`);
    }
    return { ok: true, messageId };
  }
}
