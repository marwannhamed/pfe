import {
  Injectable,
  ServiceUnavailableException,
  BadGatewayException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

type ChatMsg = { role: string; content: string };

@Injectable()
export class OpenAiService {
  constructor(private readonly config: ConfigService) {}

  private apiKey(): string | undefined {
    return this.config.get<string>('OPENAI_API_KEY')?.trim();
  }

  private model(): string {
    return this.config.get<string>('OPENAI_MODEL')?.trim() || 'gpt-4o-mini';
  }

  /** Default OpenAI; set OPENAI_BASE_URL for Groq, OpenRouter, local proxies, etc. */
  private apiBaseUrl(): string {
    const base =
      this.config.get<string>('OPENAI_BASE_URL')?.trim() ||
      'https://api.openai.com/v1';
    return base.replace(/\/$/, '');
  }

  async chat(messages: ChatMsg[], systemPrompt: string): Promise<string> {
    const key = this.apiKey();
    if (!key) {
      throw new ServiceUnavailableException(
        'OPENAI_API_KEY is not configured on the server',
      );
    }
    const body = {
      model: this.model(),
      temperature: 0.35,
      messages: [{ role: 'system', content: systemPrompt }, ...messages],
    };
    const res = await fetch(`${this.apiBaseUrl()}/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      throw new BadGatewayException(
        `OpenAI error ${res.status}: ${errText.slice(0, 400)}`,
      );
    }
    const json = (await res.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    const text = json.choices?.[0]?.message?.content?.trim();
    if (!text) throw new BadGatewayException('Empty response from OpenAI');
    return text;
  }

  /** True when a key is configured — callers fall back rather than fail. */
  isConfigured(): boolean {
    return !!this.apiKey();
  }

  /**
   * Ask for a single JSON object and parse it.
   *
   * Models wrap JSON in ``` fences or add a sentence of preamble often enough
   * that parsing the raw string fails in normal operation, so the first
   * balanced {...} is extracted before parsing. Returns null on anything
   * unparseable — every caller here has a deterministic fallback, and a
   * suggestion is never worth failing a user's request over.
   */
  async chatJson<T>(
    messages: ChatMsg[],
    systemPrompt: string,
  ): Promise<T | null> {
    let raw: string;
    try {
      raw = await this.chat(messages, systemPrompt);
    } catch {
      return null;
    }

    const start = raw.indexOf('{');
    const end = raw.lastIndexOf('}');
    if (start === -1 || end <= start) return null;

    try {
      return JSON.parse(raw.slice(start, end + 1)) as T;
    } catch {
      return null;
    }
  }
}
