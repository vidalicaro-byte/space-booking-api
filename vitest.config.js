import { readFileSync } from 'node:fs';
import { parseEnv } from 'node:util';
import { defineConfig } from 'vitest/config';

// Lê só o .env.test, sem nunca tocar no .env de desenvolvimento
const testEnv = parseEnv(readFileSync('.env.test', 'utf8'));

export default defineConfig({
  test: {
    env: testEnv,
    globalSetup: ['./tests/global-setup.js'],
    // Todos os arquivos compartilham o mesmo banco, então rodam um por vez
    fileParallelism: false,
    testTimeout: 15000,
    hookTimeout: 30000,
  },
});
