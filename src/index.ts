// ============================================================
// Onda – Express API Server
// ============================================================

import 'dotenv/config';
import express from 'express';
import helmet from 'helmet';
import cors from 'cors';

import { config } from './config';
import venuesRouter from './routes/venues';
import vibesRouter from './routes/vibes';
import passesRouter from './routes/passes';
import usersRouter from './routes/users';
import authRouter from './routes/auth';
import stripeWebhookRouter from './routes/stripeWebhook';
import { startVibeRecomputeJob } from './jobs/vibeRecompute';

const app = express();

// ---- Security & CORS ----
app.use(helmet());
app.use(cors({
  origin: process.env.FRONTEND_URL ?? '*',
  credentials: true,
}));

// ---- Stripe webhook — MUST use raw body, registered before express.json() ----
app.use(
  '/api/stripe/webhook',
  express.raw({ type: 'application/json' }),
  stripeWebhookRouter
);

// ---- Standard JSON body parser for all other routes ----
app.use(express.json());

// ---- Static files (venue scanner PWA) ----
app.use(express.static('public'));

// ---- Health check ----
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', ts: new Date().toISOString() });
});

// ---- API routes ----
app.use('/api/venues', venuesRouter);
app.use('/api/vibes', vibesRouter);
app.use('/api/passes', passesRouter);
app.use('/api/users', usersRouter);
app.use('/api/auth', authRouter);

// ---- 404 handler ----
app.use((_req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// ---- Global error handler ----
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('[server] Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// ---- Start server ----
app.listen(config.port, () => {
  console.log(`[server] Onda API running on port ${config.port} (${config.nodeEnv})`);
  startVibeRecomputeJob();
});

export default app;
