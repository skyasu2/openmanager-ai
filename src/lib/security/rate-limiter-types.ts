export interface RateLimitConfig {
  maxRequests: number;
  windowMs: number;
  dailyLimit?: number;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetTime: number;
  daily?: {
    remaining: number;
    resetTime: number;
  };
}
