import { readFileSync } from 'node:fs';
import { parseEnv } from 'node:util';

export function loadTestEnv() {
  const env = parseEnv(readFileSync('.env.test', 'utf8'));

  // No CI o banco fica em outra porta: TEST_DATABASE_URL tem prioridade sobre o arquivo
  if (process.env.TEST_DATABASE_URL) {
    env.DATABASE_URL = process.env.TEST_DATABASE_URL;
  }

  return env;
}
