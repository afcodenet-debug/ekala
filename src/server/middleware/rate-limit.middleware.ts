import { Request, Response, NextFunction } from 'express';
import { rateLimiter } from './rate-limit';

export function rateLimit(config: { windowMs: number; max: number } = { windowMs: 60_000, max: 10 }) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const key = `${req.ip}:${req.originalUrl}`;
      const result = await rateLimiter.check(key, config.windowMs, config.max);

      res.setHeader('X-RateLimit-Limit', String(config.max));
      res.setHeader('X-RateLimit-Remaining', String(result.remaining));
      res.setHeader('X-RateLimit-Reset', String(result.resetMs));

      if (!result.allowed) {
        return res.status(429).json({
          error: 'RATE_LIMIT_EXCEEDED',
          message: 'Trop de tentatives. Veuillez réessayer plus tard.',
          retryAfterMs: result.resetMs,
        });
      }

      next();
    } catch {
      next();
    }
  };
}
