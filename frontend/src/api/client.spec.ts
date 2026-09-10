import { describe, expect, it } from 'vitest';
import { api, listFromApi, unwrapApiPayload } from './client';

/** Axios stores registered interceptors on a `handlers` array. */
function responseHandlers() {
  const { handlers } = api.interceptors.response as unknown as {
    handlers: {
      fulfilled: (res: unknown) => unknown;
      rejected: (err: unknown) => Promise<never>;
    }[];
  };
  return handlers[0];
}

function requestHandler() {
  const { handlers } = api.interceptors.request as unknown as {
    handlers: { fulfilled: (cfg: unknown) => { headers: Record<string, string> } }[];
  };
  return handlers[0].fulfilled;
}

describe('unwrapApiPayload', () => {
  it('returns payload.data when wrapped in API envelope', () => {
    const wrapped = { success: true, data: { id: '1', name: 'Office' } };
    expect(unwrapApiPayload(wrapped)).toEqual({ id: '1', name: 'Office' });
  });

  it('returns original payload when not wrapped', () => {
    const plain = { id: '2', name: 'Desk' };
    expect(unwrapApiPayload(plain)).toEqual(plain);
  });

  it('passes through null and primitives untouched', () => {
    expect(unwrapApiPayload(null)).toBeNull();
    expect(unwrapApiPayload('plain')).toBe('plain');
  });
});

describe('listFromApi', () => {
  it('unwraps an axios-style response holding an array', () => {
    expect(listFromApi<{ id: string }>({ data: [{ id: 'a' }] })).toEqual([{ id: 'a' }]);
  });

  it('returns a bare array unchanged', () => {
    expect(listFromApi<number>([1, 2, 3])).toEqual([1, 2, 3]);
  });

  it('returns an empty array when the payload is not a list', () => {
    expect(listFromApi({ data: { id: 'not-a-list' } })).toEqual([]);
    expect(listFromApi({ id: 'bare-object' })).toEqual([]);
  });

  it('returns an empty array for null and undefined', () => {
    expect(listFromApi(null)).toEqual([]);
    expect(listFromApi(undefined)).toEqual([]);
  });
});

describe('request interceptor', () => {
  it('leaves Authorization unset when no token is stored', () => {
    const config = requestHandler()({ headers: {} as Record<string, string> });
    expect(config.headers.Authorization).toBeUndefined();
  });
});

describe('response interceptor', () => {
  it('unwraps the API envelope on success', () => {
    const res = responseHandlers().fulfilled({
      data: { success: true, data: [{ id: 'x' }] },
    }) as { data: unknown };
    expect(res.data).toEqual([{ id: 'x' }]);
  });

  it('derives userMessage from a string error body', async () => {
    const err = { response: { status: 400, data: 'Invalid booking window' }, config: {} };
    await expect(responseHandlers().rejected(err)).rejects.toMatchObject({
      userMessage: 'Invalid booking window',
    });
  });

  it('derives userMessage from the first entry of a validation array', async () => {
    const err = {
      response: { status: 422, data: { message: ['email must be an email', 'name required'] } },
      config: {},
    };
    await expect(responseHandlers().rejected(err)).rejects.toMatchObject({
      userMessage: 'email must be an email',
    });
  });

  it('explains how to start the backend when the API is unreachable', async () => {
    const err = { code: 'ERR_NETWORK', message: 'Network Error', config: {} };
    await expect(responseHandlers().rejected(err)).rejects.toMatchObject({
      userMessage: expect.stringContaining('Cannot reach the API'),
    });
  });

  it('falls back to a generic message when the body carries no detail', async () => {
    const err = { response: { status: 500, data: {} }, config: {} };
    await expect(responseHandlers().rejected(err)).rejects.toMatchObject({
      userMessage: 'Something went wrong. Please try again.',
    });
  });
});
