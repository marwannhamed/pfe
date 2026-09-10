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
}
