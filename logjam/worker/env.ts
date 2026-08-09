export type RateLimiter = {
  limit(input: { key: string }): Promise<{ success: boolean }>;
};

export type Env = {
  DB: D1Database;
  ASSETS: Fetcher;
  DECISION_RATE_LIMITER: RateLimiter;
  PRIVATE_MUTATION_RATE_LIMITER: RateLimiter;
  RUNTIME_ENV?: string;
  ACCESS_ENABLED?: string;
  ACCESS_TEAM_DOMAIN?: string;
  ACCESS_APP_AUD?: string;
  LOCAL_AUTH_BYPASS?: string;
  LOCAL_AUTH_USER_ID?: string;
  LOCAL_AUTH_EMAIL?: string;
  LOCAL_AUTH_NAME?: string;
};

export type AccessIdentity = {
  sub: string;
  email: string;
  displayName: string;
};

export type AppUser = {
  id: string;
  email: string;
  displayName: string;
};
