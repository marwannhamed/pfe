import { stripUserSecrets } from './response.interceptor';

const userRow = (id: string) => ({
  id,
  email: `${id}@test.local`,
  first_name: 'Rajesh',
  password: '$2b$10$hash',
  refreshToken: 'legacy-refresh',
  session_refresh_token: 'session-refresh',
});

describe('stripUserSecrets', () => {
  it('drops the hash and refresh tokens from nested user rows', () => {
    // GET /maintenance includes reporter, creator and assignee with
    // `user: true`, which returned these columns to every caller.
    const ticket = { id: 't1', title: 'Leak', user: userRow('u1'), assignedTo: userRow('u2') };

    const out = stripUserSecrets([ticket]);

    for (const u of [out[0].user, out[0].assignedTo]) {
      expect(u).toEqual({ id: expect.any(String), email: expect.any(String), first_name: 'Rajesh' });
    }
  });

  it('leaves the login response’s own tokens alone', () => {
    // The top level has no password, so it is not a user row.
    const login = { accessToken: 'a', refreshToken: 'r', user: userRow('u1') };

    const out = stripUserSecrets(login);

    expect(out.refreshToken).toBe('r');
    expect(out.user).not.toHaveProperty('password');
  });

  it('copies rather than mutating, and keeps dates and shared rows intact', () => {
    const shared = userRow('u1');
    const when = new Date('2026-10-12T09:00:00Z');
    const rows = [{ user: shared, at: when }, { user: shared, at: when }];

    const out = stripUserSecrets(rows);

    expect(shared.password).toBe('$2b$10$hash');
    expect(out[0].at).toBe(when);
    expect(out[1].user).not.toHaveProperty('password');
    expect(out[0].user).toBe(out[1].user);
  });

  it('survives circular references', () => {
    const a: Record<string, unknown> = { id: 'a' };
    a.self = a;
    const out = stripUserSecrets(a);
    expect(out.self).toBe(out);
  });
});
