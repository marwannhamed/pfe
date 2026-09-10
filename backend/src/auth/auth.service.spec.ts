import * as bcrypt from 'bcrypt';
import { AuthService } from './auth.service';
import { NotFoundException, UnauthorizedException } from '@nestjs/common';

describe('AuthService', () => {
  it('generates access and refresh tokens', async () => {
    const jwtService = {
      sign: jest
        .fn()
        .mockResolvedValueOnce('access-token')
        .mockResolvedValueOnce('refresh-token'),
    };

    const configService = {
      jwtSecret: 'jwt-secret',
      jwtExpirationTime: '1h',
      jwtRefreshSecret: 'refresh-secret',
      jwtRefreshExpirationTime: '7d',
    };

    const service = new AuthService(
      {} as any,
      jwtService as any,
      {} as any,
      {} as any,
      {} as any,
      configService as any,
    );

    const result = await service.generateTokens({ userId: 'user-1' });

    expect(jwtService.sign).toHaveBeenCalledTimes(2);
    expect(result).toEqual({
      accessToken: 'access-token',
      refreshToken: 'refresh-token',
    });
  });

  it('throws NotFoundException when login user does not exist', async () => {
    const prisma = {
      user: {
        findUnique: jest.fn().mockResolvedValue(null),
      },
    };

    const service = new AuthService(
      prisma as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
    );

    await expect(
      service.login('missing@example.com', 'password'),
    ).rejects.toThrow(NotFoundException);
  });

  it('throws UnauthorizedException when refresh token is invalid', async () => {
    const jwtService = {
      verify: jest.fn().mockImplementation(() => {
        throw new Error('invalid token');
      }),
    };

    const service = new AuthService(
      { user: { findUnique: jest.fn() } } as any,
      jwtService as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
    );

    await expect(service.refreshToken('bad-token')).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('rejects a wrong password and records a LOGIN_FAILED audit entry', async () => {
    const hashed = await bcrypt.hash('correct-password', 10);
    const prisma = {
      user: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'user-1',
          tenant_id: 'tenant-1',
          email: 'user@example.com',
          password: hashed,
        }),
        update: jest.fn(),
      },
    };
    const auditService = { log: jest.fn().mockResolvedValue(undefined) };

    const service = new AuthService(
      prisma as any,
      {} as any,
      {} as any,
      auditService as any,
      {} as any,
      {} as any,
    );

    await expect(
      service.login('user@example.com', 'wrong-password'),
    ).rejects.toThrow(UnauthorizedException);

    expect(auditService.log).toHaveBeenCalledTimes(1);
    const [tenantId, action, entity, entityId, detail] =
      auditService.log.mock.calls[0];
    expect(tenantId).toBe('tenant-1');
    expect(action).toBe('LOGIN_FAILED');
    expect(entity).toBe('USER');
    expect(entityId).toBe('user-1');
    expect(detail.newValues).toMatchObject({ reason: 'invalid_password' });
    // A failed login must not refresh last_login_at.
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it('does not leak whether an email exists on password reset', async () => {
    const prisma = { user: { findUnique: jest.fn().mockResolvedValue(null) } };
    const mailService = { sendPasswordReset: jest.fn() };

    const service = new AuthService(
      prisma as any,
      {} as any,
      mailService as any,
      {} as any,
      {} as any,
      { frontendUrl: 'http://localhost:5173' } as any,
    );

    // Returns false rather than throwing NotFound, and sends nothing.
    await expect(
      service.requestPasswordReset('nobody@example.com'),
    ).resolves.toBe(false);
    expect(mailService.sendPasswordReset).not.toHaveBeenCalled();
  });

  it('sends a reset link built from the configured frontend URL', async () => {
    const prisma = {
      user: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'user-1',
          email: 'user@example.com',
          first_name: 'Marwen',
        }),
        update: jest.fn().mockResolvedValue({}),
      },
    };
    const jwtService = { sign: jest.fn().mockReturnValue('reset-token') };
    const mailService = {
      sendPasswordReset: jest.fn().mockResolvedValue(undefined),
    };

    const service = new AuthService(
      prisma as any,
      jwtService as any,
      mailService as any,
      {} as any,
      {} as any,
      {
        frontendUrl: 'http://localhost:5173/',
        jwtSecret: 's',
        jwtExpirationTime: '1h',
        jwtRefreshSecret: 'r',
        jwtRefreshExpirationTime: '7d',
      } as any,
    );

    await expect(
      service.requestPasswordReset('user@example.com'),
    ).resolves.toBe(true);

    const [payload] = mailService.sendPasswordReset.mock.calls[0];
    expect(payload.to).toBe('user@example.com');
    expect(payload.firstName).toBe('Marwen');
    // Trailing slash on the configured URL must not produce a double slash.
    expect(payload.resetUrl).toBe(
      'http://localhost:5173/reset-password?token=reset-token',
    );
  });

  it('logout is idempotent — an unverifiable refresh token still succeeds', async () => {
    const jwtService = {
      verify: jest.fn().mockImplementation(() => {
        throw new Error('invalid token');
      }),
    };

    const service = new AuthService(
      {} as any,
      jwtService as any,
      {} as any,
      {} as any,
      {} as any,
      { jwtRefreshSecret: 'r' } as any,
    );

    // Logging out must never fail the caller: an already-invalid token means
    // the session is gone, which is the outcome the client asked for.
    await expect(service.logout('bad-token')).resolves.toBe(true);
  });

  it('lists a user’s sessions and flags the current one', async () => {
    const sessions = [
      { id: 'session-1', user_id: 'user-1', created_at: new Date() },
      { id: 'session-2', user_id: 'user-1', created_at: new Date() },
    ];
    const prisma = {
      userSession: { findMany: jest.fn().mockResolvedValue(sessions) },
    };

    const service = new AuthService(
      prisma as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
    );

    const result = await service.listSessions('user-1', 'session-2');

    expect(prisma.userSession.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { user_id: 'user-1' } }),
    );
    expect(result).toHaveLength(2);
    const current = result.find((s: any) => s.id === 'session-2');
    expect(current?.isCurrent).toBe(true);
  });
});
