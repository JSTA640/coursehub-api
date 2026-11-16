export type JwtPayload = {
  sub: number;
  email: string;
};

export type AuthenticatedUser = {
  id: number;
  email: string;
};