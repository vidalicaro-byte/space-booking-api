import SwaggerParser from '@apidevtools/swagger-parser';
import { afterAll, describe, expect, it } from 'vitest';
import { openApiDocument } from '../src/docs/openapi.js';
import { api, prisma } from './helpers.js';

afterAll(() => prisma.$disconnect());

describe('documentação OpenAPI', () => {
  it('é um documento OpenAPI válido', async () => {
    // O parser resolve os $refs mexendo no objeto, então validamos uma cópia
    await expect(SwaggerParser.validate(structuredClone(openApiDocument))).resolves.toBeDefined();
  });

  it('serve o JSON em /docs/openapi.json e a interface em /docs', async () => {
    const spec = await api().get('/docs/openapi.json');
    expect(spec.status).toBe(200);
    expect(spec.body.openapi).toBe('3.1.0');

    const ui = await api().get('/docs/');
    expect(ui.status).toBe(200);
    expect(ui.headers['content-type']).toMatch(/html/);
  });

  it('toda operação documentada existe de verdade na API (anti-deriva)', async () => {
    const id = '00000000-0000-4000-8000-000000000000';

    for (const [path, methods] of Object.entries(openApiDocument.paths)) {
      for (const method of Object.keys(methods)) {
        const url = `/api/v1${path.replace(/\{[^}]+\}/g, id)}`;
        const res = await api()[method](url).send({});

        // Só o handler de "rota inexistente" responde com o código NOT_FOUND
        expect(res.body?.error?.code, `${method.toUpperCase()} ${path}`).not.toBe('NOT_FOUND');
      }
    }
  });
});
