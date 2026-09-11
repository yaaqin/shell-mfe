import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { AdminsService } from '../admins/admins.service';
import { LoginDto } from './dto/login.dto';
import { AuthTokens, JwtAccessPayload, JwtRefreshPayload } from './types';

@Injectable()
export class AuthService {
  constructor(
    private readonly admins: AdminsService,
    private readonly jwt: JwtService,
  ) {}

  async login(dto: LoginDto) {
    const admin = await this.admins.findByIdentifier(dto.identifier);
    if (!admin) throw new UnauthorizedException('Invalid credentials');
    if (!admin.isActive) throw new UnauthorizedException('Account is inactive');

    const passwordOk = await bcrypt.compare(dto.password, admin.password);
    if (!passwordOk) throw new UnauthorizedException('Invalid credentials');

    const tokens = this.issueTokens(admin.id, admin.username, admin.email, admin.roleId);
    return { admin: this.admins.toPublicProfile(admin), ...tokens };
  }

  // Stateless refresh: no DB session to check or rotate (read-only
  // backend), so we just re-read the admin fresh — this still means a
  // deactivated/deleted admin loses access on their very next refresh,
  // even though the old refresh token's signature stays technically valid
  // until it naturally expires (there's nothing to revoke it against).
  async refresh(adminId: string) {
    const admin = await this.admins.findById(adminId);
    if (!admin) throw new UnauthorizedException('Admin no longer exists');
    if (!admin.isActive) throw new UnauthorizedException('Account is inactive');

    const tokens = this.issueTokens(admin.id, admin.username, admin.email, admin.roleId);
    return { admin: this.admins.toPublicProfile(admin), ...tokens };
  }

  async getProfile(adminId: string) {
    const admin = await this.admins.findById(adminId);
    if (!admin) throw new UnauthorizedException('Admin no longer exists');
    return this.admins.toPublicProfile(admin);
  }

  private issueTokens(
    sub: string,
    username: string,
    email: string,
    roleId: string,
  ): AuthTokens {
    const accessPayload: JwtAccessPayload = { sub, username, email, roleId };
    const accessToken = this.jwt.sign(accessPayload, {
      secret: process.env.JWT_ACCESS_SECRET,
      expiresIn: process.env.JWT_ACCESS_EXPIRES_IN || '15m',
    });

    const refreshPayload: JwtRefreshPayload = { sub };
    const refreshToken = this.jwt.sign(refreshPayload, {
      secret: process.env.JWT_REFRESH_SECRET,
      expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
    });

    return { accessToken, refreshToken };
  }
}
