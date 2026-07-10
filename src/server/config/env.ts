import { z } from 'zod';

// ⭐ CRITICAL: VITE_APP_MODE has absolute priority
// If VITE_APP_MODE=local, force all USE_SUPABASE_* to false
// If VITE_APP_MODE=cloud, force all USE_SUPABASE_* to true (if not explicitly set)
const viteAppMode = process.env.VITE_APP_MODE;
const forceLocal = viteAppMode === 'local';
const forceCloud = viteAppMode === 'cloud';

// Override USE_SUPABASE_* variables based on VITE_APP_MODE
const overrides: Record<string, string | boolean | undefined> = {};
if (forceLocal) {
  overrides.USE_SUPABASE_PRODUCTS = 'false';
  overrides.USE_SUPABASE_TABLES = 'false';
  overrides.USE_SUPABASE_ORDERS = 'false';
  overrides.RENDER_CLOUD_MODE = false;
} else if (forceCloud) {
  overrides.USE_SUPABASE_PRODUCTS = 'true';
  overrides.USE_SUPABASE_TABLES = 'true';
  overrides.USE_SUPABASE_ORDERS = 'true';
}

// Merge overrides with process.env (overrides take precedence)
const mergedEnv = { ...process.env, ...overrides };

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production']).default('development'),
  SUPABASE_URL: z.string().url().optional(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(20).optional(),
  USE_SUPABASE_PRODUCTS: z.coerce.boolean().default(false),
  USE_SUPABASE_TABLES: z.coerce.boolean().default(false),
  USE_SUPABASE_ORDERS: z.coerce.boolean().default(false),
  RENDER_CLOUD_MODE: z.coerce.boolean().default(false),
  ENABLE_SUPABASE_SYNC: z.coerce.boolean().default(false),
  ENABLE_SUPABASE_PULL: z.coerce.boolean().default(false),
  ENABLE_SUPABASE_REALTIME_PULL: z.coerce.boolean().default(true),
  SUPABASE_PULL_INTERVAL_MS: z.coerce.number().default(8000),
  SUPABASE_PULL_LOOKBACK_MIN: z.coerce.number().default(120),
  USE_V2_SUBSCRIPTION_FLOW: z.coerce.boolean().default(false),
  CORS_ORIGINS: z.string().optional(),
  DATA_DIR: z.string().optional(),
  JWT_SECRET: z.string().min(16).optional(),
});

export const env = envSchema.parse(mergedEnv);
