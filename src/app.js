import { docsRouter } from './docs/docs.routes.js';
import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import { env } from './config/env.js';
import { errorHandler, notFoundHandler } from './middlewares/error-handler.js';
import { httpLogger } from './middlewares/http-logger.js';
import { apiLimiter } from './middlewares/rate-limit.js';
import { authRouter } from './modules/auth/auth.routes.js';
import { bookingsRouter } from './modules/bookings/bookings.routes.js';
import { roomsRouter } from './modules/rooms/rooms.routes.js';
import { prisma } from './lib/prisma.js';

export const app = express();

app.set('trust proxy', env.TRUST_PROXY);

app.use(httpLogger);

app.use('/docs', docsRouter);
app.get('/', (_req, res) => res.redirect('/docs'));

app.use(helmet());
app.use(cors({ origin: env.CORS_ORIGINS }));
app.use(express.json({ limit: '10kb' }));

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', uptime: process.uptime() });
});

// Liveness (/health): "o processo está de pé". Readiness: "consigo atender, banco incluso".
app.get('/health/ready', async (_req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ status: 'ok', database: 'up' });
  } catch {
    res.status(503).json({ status: 'error', database: 'down' });
  }
});

app.use('/api', apiLimiter);
app.use('/api/v1/auth', authRouter);
app.use('/api/v1/rooms', roomsRouter);
app.use('/api/v1/bookings', bookingsRouter);

app.use(notFoundHandler);
app.use(errorHandler);
