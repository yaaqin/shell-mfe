import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { JwtRefreshPayload } from '../types';

// Refresh tokens are pure stateless JWTs — there is no DB-backed session
// table for them (this backend is read-only against the shared DB), so
// there's nothing to look up or revoke here, just signature + expiry
// verification via passport-jwt.
@Injectable()
export class JwtRefreshStrategy extends PassportStrategy(
  Strategy,
  'jwt-refresh',
) {
  constructor() {
    super({
      jwtFromRequest: ExtractJwt.fromBodyField('refreshToken'),
      ignoreExpiration: false,
      secretOrKey: process.env.JWT_REFRESH_SECRET as string,
    });
  }

  validate(payload: JwtRefreshPayload) {
    return payload;
  }
}
