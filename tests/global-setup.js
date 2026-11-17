import { execSync } from 'node:child_process';
import { loadTestEnv } from './load-test-env.js';

export default function setup() {
  const env = loadTestEnv();
  const dbName = new URL(env.DATABASE_URL).pathname.slice(1);

  if (!dbName.endsWith('_test')) {
    throw new Error(`Recusando rodar testes: o banco "${dbName}" não termina com _test`);
  }

  // Aplica todas as migrations (inclusive a constraint de conflito) no banco de testes
  execSync('npx prisma migrate deploy', {
    stdio: 'inherit',
    env: { ...process.env, DATABASE_URL: env.DATABASE_URL },
  });
}
