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

    await expect(service.login('missing@example.com', 'password')).rejects.toThrow(
      NotFoundException,
    );
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
});
