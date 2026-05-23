import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production']).default('development'),
  SUPABASE_URL: z.string().url().optional(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(20).optional(),
  USE_SUPABASE_PRODUCTS: z.coerce.boolean().default(false),
  USE_SUPABASE_TABLES: z.coerce.boolean().default(false),
  RENDER_CLOUD_MODE: z.coerce.boolean().default(false),
});

export const env = envSchema.parse(process.env);
