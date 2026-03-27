export interface AuthUser {
  id: string;
  email?: string;
  name?: string;
  avatar?: string;
  provider?: 'github' | 'google' | 'guest';
}

export interface AuthState {
  user: AuthUser | null;
  type: 'github' | 'google' | 'guest' | 'unknown';
  isAuthenticated: boolean;
  sessionId?: string;
}
