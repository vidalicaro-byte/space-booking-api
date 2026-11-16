import { app } from './app.js';
import { env } from './config/env.js';
import { logger } from './lib/logger.js';
import { prisma } from './lib/prisma.js';

const server = app.listen(env.PORT, () => {
  logger.info(`API rodando em http://localhost:${env.PORT} (${env.NODE_ENV})`);
});

function shutdown(signal) {
  logger.info({ signal }, 'Sinal recebido, encerrando...');

  // Para de aceitar conexões novas e espera as em andamento terminarem
  server.close(async () => {
    await prisma.$disconnect();
    logger.info('Encerrado com sucesso');
    process.exit(0);
  });

  // Rede de segurança: se algo travar, não fica pendurado para sempre
  setTimeout(() => {
    logger.error('Encerramento forçado por timeout');
    process.exit(1);
  }, 10_000).unref();
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
