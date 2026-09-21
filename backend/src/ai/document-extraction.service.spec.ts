import { DocumentExtractionService } from './document-extraction.service';
import { BadRequestException } from '@nestjs/common';

function makeService(opts: { json?: unknown; configured?: boolean } = {}) {
  const openAi = {
    isConfigured: jest.fn().mockReturnValue(opts.configured ?? true),
    chatJson: jest.fn().mockResolvedValue(opts.json ?? null),
  };
  return { openAi, service: new DocumentExtractionService(openAi as never) };
}

const textFile = (body: string) => ({
  buffer: Buffer.from(body, 'utf8'),
  originalname: 'licence.txt',
  mimetype: 'text/plain',
});

const LICENCE = `STATE OF QATAR
MINISTRY OF COMMERCE AND INDUSTRY
Company Name: NAJMA ARCHITECTS W.L.L.
License Number: CTL-2024-118377
Issue Date: 14/03/2024
Expiry Date: 13/03/2027
Activity: Architectural design`;

describe('DocumentExtractionService — a document is read, never invented', () => {
  it('returns the fields the model found', async () => {
    const { service } = makeService({
      json: {
        company_name: 'NAJMA ARCHITECTS W.L.L.',
        license_number: 'CTL-2024-118377',
        issue_date: '2024-03-14',
        expiry_date: '2027-03-13',
        activity: 'Architectural design',
      },
    });

    const r = await service.extract(textFile(LICENCE), 'trade_license');

    expect(r.source).toBe('model');
    expect(r.fields.company_name).toBe('NAJMA ARCHITECTS W.L.L.');
    expect(r.confidence).toBe(1);
  });

  it('keeps only the fields the document type asks for', async () => {
    // A model is free to answer with anything; only known keys reach the form.
    const { service } = makeService({
      json: {
        company_name: 'ACME',
        license_number: 'X1',
        issue_date: null,
        expiry_date: null,
        activity: null,
        secret_internal_note: 'should not appear',
        password: 'nor this',
      },
    });

    const r = await service.extract(textFile(LICENCE), 'trade_license');

    expect(Object.keys(r.fields).sort()).toEqual([
      'activity',
      'company_name',
      'expiry_date',
      'issue_date',
      'license_number',
    ]);
  });

  it('reports partial confidence and names what is missing', async () => {
    const { service } = makeService({
      json: { company_name: 'ACME', license_number: 'X1' },
    });

    const r = await service.extract(textFile(LICENCE), 'trade_license');

    expect(r.confidence).toBe(0.4); // 2 of 5
    expect(r.notes.join(' ')).toContain('issue_date');
  });

  it('treats a file with no text layer as unreadable rather than guessing', async () => {
    const { openAi, service } = makeService();

    const r = await service.extract(
      {
        buffer: Buffer.from([0x89, 0x50]),
        originalname: 'scan.png',
        mimetype: 'image/png',
      },
      'cheque',
    );

    expect(r.source).toBe('unreadable');
    expect(r.fields).toEqual({});
    expect(openAi.chatJson).not.toHaveBeenCalled();
  });

  it('does not call the model when none is configured', async () => {
    const { openAi, service } = makeService({ configured: false });

    const r = await service.extract(textFile(LICENCE), 'trade_license');

    expect(r.source).toBe('unreadable');
    expect(openAi.chatJson).not.toHaveBeenCalled();
  });

  it('reports unreadable when the model answers with nothing usable', async () => {
    const { service } = makeService({ json: null });

    const r = await service.extract(textFile(LICENCE), 'trade_license');

    expect(r.source).toBe('unreadable');
    expect(r.confidence).toBe(0);
  });

  it('rejects a file type it cannot read at all', async () => {
    const { service } = makeService();

    await expect(
      service.extract(
        {
          buffer: Buffer.from('x'),
          originalname: 'a.zip',
          mimetype: 'application/zip',
        },
        'other',
      ),
    ).rejects.toThrow(BadRequestException);
  });

  it('always tells the reviewer the values need checking', async () => {
    const { service } = makeService({
      json: {
        company_name: 'ACME',
        license_number: 'X1',
        issue_date: '2024-01-01',
        expiry_date: '2027-01-01',
        activity: 'x',
      },
    });

    const r = await service.extract(textFile(LICENCE), 'trade_license');

    expect(r.notes.join(' ')).toMatch(/check it against the document/i);
  });

  it('asks for the right fields for a cheque', async () => {
    const { openAi, service } = makeService({ json: {} });

    await service.extract(textFile('Bank of Doha ... 4,500.00'), 'cheque');

    const system = openAi.chatJson.mock.calls[0][1];
    for (const f of ['payer_name', 'bank_name', 'cheque_number', 'amount']) {
      expect(system).toContain(f);
    }
  });
});
