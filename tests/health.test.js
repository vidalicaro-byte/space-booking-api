import { afterAll, describe, expect, it } from 'vitest';
import { api, prisma } from './helpers.js';

afterAll(() => prisma.$disconnect());

describe('health checks', () => {
  it('/health responde sem depender do banco', async () => {
    const res = await api().get('/health');

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
  });

  it('/health/ready confirma que o banco responde', async () => {
    const res = await api().get('/health/ready');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'ok', database: 'up' });
  });
});
