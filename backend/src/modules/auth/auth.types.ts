export interface User {
  id: string;
  email: string;
  name: string | null;
  created_at: Date;
}

export interface AuthUser {
  id: string;
  email: string;
  name?: string | null;
}

export interface TokenPayload {
  userId: string;
  email: string;
  iat?: number;
  exp?: number;
}

export interface LoginInput {
  email: string;
  name?: string;
}

export interface AuthResponse {
  user: {
    id: string;
    email: string;
    name: string | null;
    createdAt: string;
  };
  token: string;
}
