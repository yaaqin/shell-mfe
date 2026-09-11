export interface JwtAccessPayload {
  sub: string; // admin id
  username: string;
  email: string;
  roleId: string;
}

export interface JwtRefreshPayload {
  sub: string; // admin id
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}
