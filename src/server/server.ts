import express from 'express';
import menuRoutes from './routes/menu';
import { env } from './config/env';

process.on('uncaughtException', (err) => {
  console.error('[RENDER CRASH] uncaughtException:', err);
  process.exit(1);
});

process.on('unhandledRejection', (reason) => {
  console.error('[RENDER CRASH] unhandledRejection:', reason);
  process.exit(1);
});

const app = express();
app.use(express.json());

console.log('[RENDER START] booting express server...');

app.use('/api/menu', menuRoutes);

app.get('/health', (_req, res) => res.json({ status: 'ok' }));

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Supabase mode → PRODUCTS=${env.USE_SUPABASE_PRODUCTS}, TABLES=${env.USE_SUPABASE_TABLES}`);
});
