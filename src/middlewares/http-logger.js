import { randomUUID } from 'node:crypto';
import pinoHttp from 'pino-http';
import { logger } from '../lib/logger.js';

export const httpLogger = pinoHttp({
  logger,
  // Reaproveita o ID que um proxy/front enviou, ou gera um novo, e devolve no header
  genReqId: (req, res) => {
    const incoming = req.headers['x-request-id'];
    const id = typeof incoming === 'string' && incoming.length <= 100 ? incoming : randomUUID();
    res.setHeader('X-Request-Id', id);
    return id;
  },
  customLogLevel: (_req, res, err) => {
    if (err || res.statusCode >= 500) return 'error';
    if (res.statusCode >= 400) return 'warn';
    return 'info';
  },
  autoLogging: { ignore: (req) => req.url === '/health' },
});
