import express from 'express';
import request from 'supertest';
import { afterAll, describe, expect, it } from 'vitest';
import { createLimiter } from '../src/middlewares/rate-limit.js';
import { api, prisma } from './helpers.js';

afterAll(() => prisma.$disconnect());

describe('cabeçalhos de segurança', () => {
  it('envia headers do helmet e não expõe X-Powered-By', async () => {
    const res = await api().get('/health');

    expect(res.headers['x-powered-by']).toBeUndefined();
    expect(res.headers['x-content-type-options']).toBe('nosniff');
  });

  it('devolve um X-Request-Id e reaproveita o enviado pelo cliente', async () => {
    const generated = await api().get('/health');
    expect(generated.headers['x-request-id']).toBeTypeOf('string');

    const echoed = await api().get('/health').set('X-Request-Id', 'meu-id-123');
    expect(echoed.headers['x-request-id']).toBe('meu-id-123');
  });
});

describe('CORS', () => {
  it('libera a origem configurada e não libera outras', async () => {
    const allowed = await api().get('/health').set('Origin', 'http://localhost:5173');
    expect(allowed.headers['access-control-allow-origin']).toBe('http://localhost:5173');

    const blocked = await api().get('/health').set('Origin', 'http://site-malicioso.com');
    expect(blocked.headers['access-control-allow-origin']).toBeUndefined();
  });
});

describe('limite de corpo', () => {
  it('recusa JSON grande demais com 413', async () => {
    const res = await api()
      .post('/api/v1/auth/login')
      .send({ email: 'a@b.com', password: 'x'.repeat(20000) });

    expect(res.status).toBe(413);
    expect(res.body.error.code).toBe('PAYLOAD_TOO_LARGE');
  });
});

describe('rate limiting', () => {
  it('bloqueia com 429 depois do limite, no formato padrão de erro', async () => {
    const app = express();
    app.use(createLimiter({ limit: 3, windowMs: 60_000 }));
    app.get('/', (_req, res) => res.json({ ok: true }));

    const responses = [];
    for (let i = 0; i < 5; i += 1) responses.push(await request(app).get('/'));

    expect(responses.map((r) => r.status)).toEqual([200, 200, 200, 429, 429]);
    expect(responses[4].body.error.code).toBe('RATE_LIMITED');
  });
});
