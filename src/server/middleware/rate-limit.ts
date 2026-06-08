export interface RateLimitConfig {
  windowMs: number;
  max: number;
  key?: string;
}

export class InMemoryRateLimiter {
  private hits = new Map<string, { count: number; expires: number }>();

  async check(key: string, windowMs: number, max: number): Promise<{ allowed: boolean; remaining: number; resetMs: number }> {
    const now = Date.now();
    const entry = this.hits.get(key);
    if (!entry || now > entry.expires) {
      this.hits.set(key, { count: 1, expires: now + windowMs });
      return { allowed: true, remaining: max - 1, resetMs: windowMs };
    }

    const remaining = max - entry.count;
    const resetMs = Math.max(0, entry.expires - now);

    if (entry.count >= max) {
      return { allowed: false, remaining: 0, resetMs };
    }

    entry.count++;
    return { allowed: true, remaining: Math.max(0, remaining - 1), resetMs };
  }

  cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of this.hits) {
      if (now > entry.expires) this.hits.delete(key);
    }
  }
}

export const rateLimiter = new InMemoryRateLimiter();
setInterval(() => rateLimiter.cleanup(), 60_000);
