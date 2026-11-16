import express from 'express';
import { authRouter } from './modules/auth/auth.routes.js';
import { errorHandler, notFoundHandler } from './middlewares/error-handler.js';

export const app = express();

app.use(express.json());

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', uptime: process.uptime() });
});

app.use('/api/v1/auth', authRouter);

app.use(notFoundHandler);
app.use(errorHandler);
