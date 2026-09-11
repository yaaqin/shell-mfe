import { IsOptional, IsString } from 'class-validator';

// refreshToken is optional in the body because the SSR app sends it via
// an httpOnly cookie instead (read by JwtRefreshStrategy).
export class RefreshDto {
  @IsOptional()
  @IsString()
  refreshToken?: string;
}
