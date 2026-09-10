import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { UserService } from '../user/user.service';
import { ConfigurationService } from '../config/configuration.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(
    private usersService: UserService,
    private configService: ConfigurationService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      secretOrKey: configService.jwtSecret,
    });
  }

  // ✅ userId est maintenant un string (UUID)
  async validate(payload: { userId: string; sessionId?: string }) {
    const user = await this.usersService.findOne(payload.userId);
    if (!user) throw new UnauthorizedException();
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { password, ...safe } = user as any;
    return { ...safe, sessionId: payload.sessionId ?? null };
  }
}
