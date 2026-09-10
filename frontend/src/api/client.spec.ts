import { describe, expect, it } from 'vitest';
import { unwrapApiPayload } from './client';

describe('unwrapApiPayload', () => {
  it('returns payload.data when wrapped in API envelope', () => {
    const wrapped = { success: true, data: { id: '1', name: 'Office' } };
    expect(unwrapApiPayload(wrapped)).toEqual({ id: '1', name: 'Office' });
  });

  it('returns original payload when not wrapped', () => {
    const plain = { id: '2', name: 'Desk' };
    expect(unwrapApiPayload(plain)).toEqual(plain);
  });
});
