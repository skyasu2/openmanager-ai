export interface AuthUser {
  id: string;
  email?: string;
  name?: string;
  avatar?: string;
  provider?: 'github' | 'google' | 'guest';
}

export type AuthProvider = NonNullable<AuthUser['provider']>;

export interface AuthState {
  user: AuthUser | null;
  type: 'github' | 'google' | 'guest' | 'unknown';
  isAuthenticated: boolean;
  sessionId?: string;
}
