export interface JwtPayload {
  sub: number;
  username: string;
}

export interface AuthenticatedUser {
  id: number;
  username: string;
}

export interface RequestWithUser {
  user: AuthenticatedUser;
}
