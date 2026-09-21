import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { OpenAiService } from './openai.service';

/**
 * Pull the fields a manager would otherwise retype out of an uploaded
 * document — a trade licence, a commercial registration, a cheque.
 *
 * Two stages, deliberately separated:
 *
 *   1. get text out of the file   (local, deterministic)
 *   2. turn that text into fields (the model)
 *
 * Stage 1 is local because the text layer of a digitally issued PDF is exact,
 * while a model reading a picture of one is a guess. Where a document has no
 * text layer — a phone photo, a flatbed scan — stage 1 has nothing to give and
 * the caller is told so plainly rather than handed invented values.
 *
 * Adding a vision model is a configuration change, not a rewrite: point
 * OPENAI_BASE_URL and OPENAI_MODEL at a provider that accepts image input and
 * extend readText() to pass the image through. The Groq deployment this runs
 * on today serves text models only.
 */

export type DocumentKind =
  | 'trade_license'
  | 'cr_copy'
  | 'qid_copy'
  | 'cheque'
  | 'other';

export type ExtractedDocument = {
  kind: DocumentKind;
  fields: Record<string, string | number | null>;
  /** 0–1. How much of the expected field set actually came back. */
  confidence: number;
  /** Shown to the reviewer so they know what to check. */
  notes: string[];
  source: 'model' | 'unreadable';
};

/** What each document type is worth asking for. */
const EXPECTED: Record<DocumentKind, string[]> = {
  trade_license: [
    'company_name',
    'license_number',
    'issue_date',
    'expiry_date',
    'activity',
  ],
  cr_copy: [
    'company_name',
    'cr_number',
    'issue_date',
    'expiry_date',
    'legal_form',
  ],
  qid_copy: ['holder_name', 'qid_number', 'nationality', 'expiry_date'],
  cheque: [
    'payer_name',
    'bank_name',
    'cheque_number',
    'amount',
    'currency',
    'cheque_date',
  ],
  other: ['company_name', 'document_number', 'issue_date', 'expiry_date'],
};

@Injectable()
export class DocumentExtractionService {
  private readonly logger = new Logger(DocumentExtractionService.name);

  constructor(private readonly openAi: OpenAiService) {}

  async extract(
    file: { buffer: Buffer; originalname: string; mimetype: string },
    kind: DocumentKind,
  ): Promise<ExtractedDocument> {
    const text = await this.readText(file);

    if (!text || text.trim().length < 25) {
      return {
        kind,
        fields: {},
        confidence: 0,
        source: 'unreadable',
        notes: [
          'No text layer was found in this file.',
          'Scans and photographs need an image-capable model; a PDF exported from the issuing system reads fine.',
        ],
      };
    }

    if (!this.openAi.isConfigured()) {
      return {
        kind,
        fields: {},
        confidence: 0,
        source: 'unreadable',
        notes: ['No AI provider is configured on the server.'],
      };
    }

    const wanted = EXPECTED[kind] ?? EXPECTED.other;
    const system = `You read scanned business documents and return structured data.
Reply with ONLY a JSON object, no prose and no code fences, with exactly these keys:
${wanted.map((f) => `"${f}"`).join(', ')}

Rules:
- Copy values exactly as they appear. Do not translate, reformat or tidy them.
- Dates as YYYY-MM-DD when the day, month and year are all legible; otherwise null.
- Amounts as a plain number, no currency symbol or thousands separators.
- Use null for anything the text does not clearly state. Never guess.`;

    // Long documents waste tokens and bury the fields, which sit near the top.
    const excerpt = text.replace(/\s+\n/g, '\n').slice(0, 6000);

    const parsed = await this.openAi.chatJson<Record<string, unknown>>(
      [{ role: 'user', content: excerpt }],
      system,
    );

    if (!parsed) {
      return {
        kind,
        fields: {},
        confidence: 0,
        source: 'unreadable',
        notes: ['The document was read but could not be interpreted.'],
      };
    }

    // Only the keys asked for reach the caller; a model is free to add others.
    const fields: Record<string, string | number | null> = {};
    for (const key of wanted) {
      const v = parsed[key];
      fields[key] =
        v === null || v === undefined || v === ''
          ? null
          : (v as string | number);
    }

    const found = wanted.filter((f) => fields[f] !== null).length;
    const confidence = Math.round((found / wanted.length) * 100) / 100;

    const notes: string[] = [];
    const missing = wanted.filter((f) => fields[f] === null);
    if (missing.length) {
      notes.push(`Not found in the document: ${missing.join(', ')}.`);
    }
    notes.push(
      'Every field is a suggestion — check it against the document before saving.',
    );

    return { kind, fields, confidence, source: 'model', notes };
  }

  /** Stage 1. Local, deterministic, no network. */
  private async readText(file: {
    buffer: Buffer;
    originalname: string;
    mimetype: string;
  }): Promise<string> {
    const name = (file.originalname ?? '').toLowerCase();
    const isPdf = file.mimetype === 'application/pdf' || name.endsWith('.pdf');

    if (isPdf) {
      let parser: {
        getText: () => Promise<{ text?: string }>;
        destroy: () => void;
      } | null = null;
      try {
        // Imported lazily so a parser problem cannot stop the app booting.
        const { PDFParse } = await import('pdf-parse');
        parser = new PDFParse({ data: new Uint8Array(file.buffer) });
        const out = await parser.getText();
        return out?.text ?? '';
      } catch (err) {
        this.logger.warn(
          `Could not read PDF ${file.originalname}: ${(err as Error).message}`,
        );
        return '';
      } finally {
        // pdf.js holds worker resources until told otherwise.
        try {
          parser?.destroy();
        } catch {
          /* already gone */
        }
      }
    }

    if (file.mimetype?.startsWith('text/')) {
      return file.buffer.toString('utf8');
    }

    // Images carry no text layer. Reported as unreadable rather than guessed.
    if (file.mimetype?.startsWith('image/')) return '';

    throw new BadRequestException(
      `Unsupported document type: ${file.mimetype || 'unknown'}. Upload a PDF.`,
    );
  }
}
