import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production']).default('development'),
  SUPABASE_URL: z.string().url().optional(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(20).optional(),
  USE_SUPABASE_PRODUCTS: z.coerce.boolean().default(false),
  USE_SUPABASE_TABLES: z.coerce.boolean().default(false),
  USE_SUPABASE_ORDERS: z.coerce.boolean().default(false),
  RENDER_CLOUD_MODE: z.coerce.boolean().default(false),
  ENABLE_SUPABASE_PULL: z.coerce.boolean().default(false),
  ENABLE_SUPABASE_REALTIME_PULL: z.coerce.boolean().default(true),
  SUPABASE_PULL_INTERVAL_MS: z.coerce.number().default(8000),
  SUPABASE_PULL_LOOKBACK_MIN: z.coerce.number().default(120),
  USE_V2_SUBSCRIPTION_FLOW: z.coerce.boolean().default(false),
  CORS_ORIGINS: z.string().optional(),
  DATA_DIR: z.string().optional(),
  JWT_SECRET: z.string().min(16).optional(),
});

export const env = envSchema.parse(process.env);
