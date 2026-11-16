import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { api, authHeader, createUser, prisma, resetDb, TEST_PASSWORD } from './helpers.js';

const url = (path) => `/api/v1/auth${path}`;

beforeEach(resetDb);
afterAll(() => prisma.$disconnect());

describe('POST /auth/register', () => {
  it('cria o usuário como MEMBER, normaliza o e-mail e não expõe o hash', async () => {
    const res = await api()
      .post(url('/register'))
      .send({ name: 'Ana', email: 'ANA@Example.com', password: TEST_PASSWORD, role: 'ADMIN' });

    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({ email: 'ana@example.com', role: 'MEMBER' });
    expect(res.body.data).not.toHaveProperty('passwordHash');
  });

  it('recusa e-mail já cadastrado com 409', async () => {
    const user = await createUser();
    const res = await api()
      .post(url('/register'))
      .send({ name: 'Outra', email: user.email, password: TEST_PASSWORD });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('EMAIL_IN_USE');
  });

  it('recusa dados inválidos com 400 e detalha os campos', async () => {
    const res = await api().post(url('/register')).send({ name: 'A', email: 'x', password: '1' });

    expect(res.status).toBe(400);
    expect(res.body.error.details.map((d) => d.field)).toEqual(['name', 'email', 'password']);
  });
});

describe('POST /auth/login', () => {
  it('devolve access e refresh token', async () => {
    const user = await createUser();
    const res = await api()
      .post(url('/login'))
      .send({ email: user.email, password: TEST_PASSWORD });

    expect(res.status).toBe(200);
    expect(res.body.data.accessToken).toBeTypeOf('string');
    expect(res.body.data.refreshToken).toBeTypeOf('string');
  });

  it('responde igual para senha errada e e-mail inexistente', async () => {
    const user = await createUser();
    const wrongPassword = await api()
      .post(url('/login'))
      .send({ email: user.email, password: 'senha-errada-123' });
    const unknownEmail = await api()
      .post(url('/login'))
      .send({ email: 'ninguem@test.com', password: TEST_PASSWORD });

    expect(wrongPassword.status).toBe(401);
    expect(unknownEmail.status).toBe(401);
    expect(wrongPassword.body).toEqual(unknownEmail.body);
  });
});

describe('GET /auth/me', () => {
  it('devolve o usuário dono do token', async () => {
    const user = await createUser();
    const res = await api().get(url('/me')).set(authHeader(user));

    expect(res.status).toBe(200);
    expect(res.body.data.email).toBe(user.email);
  });

  it('recusa sem token e com token falso', async () => {
    expect((await api().get(url('/me'))).status).toBe(401);
    const fake = await api().get(url('/me')).set('Authorization', 'Bearer isto.nao.eh-um-token');
    expect(fake.status).toBe(401);
  });
});

describe('refresh token', () => {
  async function loginAs(user) {
    const res = await api()
      .post(url('/login'))
      .send({ email: user.email, password: TEST_PASSWORD });
    return res.body.data.refreshToken;
  }

  it('rotaciona o token e detecta reuso revogando a família inteira', async () => {
    const user = await createUser();
    const first = await loginAs(user);

    const refreshed = await api().post(url('/refresh')).send({ refreshToken: first });
    expect(refreshed.status).toBe(200);
    expect(refreshed.body.data.refreshToken).not.toBe(first);

    const reuse = await api().post(url('/refresh')).send({ refreshToken: first });
    expect(reuse.status).toBe(401);
    expect(reuse.body.error.code).toBe('REFRESH_TOKEN_REUSED');

    // O token novo também morreu, porque a família foi revogada
    const afterReuse = await api()
      .post(url('/refresh'))
      .send({ refreshToken: refreshed.body.data.refreshToken });
    expect(afterReuse.status).toBe(401);
  });

  it('logout revoga o refresh token', async () => {
    const user = await createUser();
    const token = await loginAs(user);

    expect((await api().post(url('/logout')).send({ refreshToken: token })).status).toBe(204);
    expect((await api().post(url('/refresh')).send({ refreshToken: token })).status).toBe(401);
  });
});
