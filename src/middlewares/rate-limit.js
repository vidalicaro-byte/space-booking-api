import rateLimit from 'express-rate-limit';
import { env } from '../config/env.js';

export const createLimiter = (options) =>
  rateLimit({
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    handler: (_req, res, _next, opts) => {
      res.status(opts.statusCode).json({
        error: {
          code: 'RATE_LIMITED',
          message: 'Muitas requisições. Tente novamente em instantes.',
        },
      });
    },
    ...options,
  });

// Nos testes automatizados os limites ficam desligados (o limitador em si é testado à parte)
const skip = () => env.NODE_ENV === 'test';

// Teto geral para toda a API
export const apiLimiter = createLimiter({ windowMs: 15 * 60 * 1000, limit: 300, skip });

// Login: 10 tentativas FALHAS por 15 min. Login com sucesso não conta.
export const loginLimiter = createLimiter({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  skipSuccessfulRequests: true,
  skip,
});

// Cadastro: conta tudo, para dificultar criação em massa de contas
export const registerLimiter = createLimiter({ windowMs: 60 * 60 * 1000, limit: 10, skip });
