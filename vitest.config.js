import { defineConfig } from 'vitest/config';
import { loadTestEnv } from './tests/load-test-env.js';

export default defineConfig({
  test: {
    env: loadTestEnv(),
    globalSetup: ['./tests/global-setup.js'],
    // Todos os arquivos compartilham o mesmo banco, então rodam um por vez
    fileParallelism: false,
    testTimeout: 15000,
    hookTimeout: 30000,
  },
});
