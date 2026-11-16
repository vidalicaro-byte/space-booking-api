import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { api, authHeader, createRoom, createUser, prisma, resetDb } from './helpers.js';

let admin;
let member;

beforeEach(async () => {
  await resetDb();
  admin = await createUser({ role: 'ADMIN' });
  member = await createUser();
});
afterAll(() => prisma.$disconnect());

describe('permissões', () => {
  it('membro não cria sala (403), admin cria (201)', async () => {
    const body = { name: 'Sala Alfa', capacity: 10 };

    const asMember = await api().post('/api/v1/rooms').set(authHeader(member)).send(body);
    expect(asMember.status).toBe(403);

    const asAdmin = await api().post('/api/v1/rooms').set(authHeader(admin)).send(body);
    expect(asAdmin.status).toBe(201);
  });

  it('recusa nome de sala repetido com 409', async () => {
    await createRoom({ name: 'Sala Alfa' });
    const res = await api()
      .post('/api/v1/rooms')
      .set(authHeader(admin))
      .send({ name: 'Sala Alfa', capacity: 5 });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('ROOM_NAME_IN_USE');
  });

  it('sala desativada some para o membro, mas o admin ainda vê', async () => {
    const room = await createRoom({ active: false });

    const asMember = await api().get(`/api/v1/rooms/${room.id}`).set(authHeader(member));
    expect(asMember.status).toBe(404);

    const asAdmin = await api().get(`/api/v1/rooms/${room.id}`).set(authHeader(admin));
    expect(asAdmin.status).toBe(200);
    expect(asAdmin.body.data.active).toBe(false);
  });
});

describe('listagem', () => {
  it('pagina corretamente e informa o total', async () => {
    for (let i = 0; i < 5; i += 1) await createRoom();

    const res = await api().get('/api/v1/rooms?limit=2&page=3').set(authHeader(member));

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.meta).toEqual({ page: 3, limit: 2, total: 5, totalPages: 3 });
  });

  it('filtra por capacidade mínima', async () => {
    await createRoom({ capacity: 4 });
    await createRoom({ capacity: 20 });

    const res = await api().get('/api/v1/rooms?minCapacity=10').set(authHeader(member));

    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].capacity).toBe(20);
  });
});
