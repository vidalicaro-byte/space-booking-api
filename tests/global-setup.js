import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { parseEnv } from 'node:util';

export default function setup() {
  const env = parseEnv(readFileSync('.env.test', 'utf8'));
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
