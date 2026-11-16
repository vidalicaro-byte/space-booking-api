import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { api, authHeader, createRoom, createUser, prisma, resetDb } from './helpers.js';

const MIN = 60 * 1000;
// Base fixa (daqui a 3 dias): assim "termina às 11h" e "começa às 11h" são exatamente iguais
const BASE = Date.now() + 72 * 60 * MIN;

const slot = (fromMin, toMin) => ({
  startsAt: new Date(BASE + fromMin * MIN).toISOString(),
  endsAt: new Date(BASE + toMin * MIN).toISOString(),
});

const book = (user, roomId, times) =>
  api()
    .post('/api/v1/bookings')
    .set(authHeader(user))
    .send({ roomId, ...times });

const cancel = (user, id) => api().post(`/api/v1/bookings/${id}/cancel`).set(authHeader(user));

let ana;
let bruno;
let admin;
let room;

beforeEach(async () => {
  await resetDb();
  ana = await createUser();
  bruno = await createUser();
  admin = await createUser({ role: 'ADMIN' });
  room = await createRoom();
});
afterAll(() => prisma.$disconnect());

describe('conflito de horários', () => {
  it('aceita a primeira reserva', async () => {
    const res = await book(ana, room.id, slot(0, 60));

    expect(res.status).toBe(201);
    expect(res.body.data.status).toBe('CONFIRMED');
  });

  it('recusa horário idêntico e sobreposição parcial com 409', async () => {
    await book(ana, room.id, slot(0, 60));

    const same = await book(bruno, room.id, slot(0, 60));
    const partial = await book(bruno, room.id, slot(30, 90));

    expect(same.status).toBe(409);
    expect(same.body.error.code).toBe('BOOKING_CONFLICT');
    expect(partial.status).toBe(409);
  });

  it('aceita reserva que começa exatamente quando a anterior termina', async () => {
    await book(ana, room.id, slot(0, 60));
    const res = await book(bruno, room.id, slot(60, 120));

    expect(res.status).toBe(201);
  });

  it('aceita o mesmo horário em outra sala', async () => {
    const other = await createRoom();
    await book(ana, room.id, slot(0, 60));
    const res = await book(bruno, other.id, slot(0, 60));

    expect(res.status).toBe(201);
  });

  it('com 10 requisições simultâneas pelo mesmo horário, só uma vence', async () => {
    const times = slot(0, 60);
    const responses = await Promise.all(
      Array.from({ length: 10 }, () => book(ana, room.id, times)),
    );
    const statuses = responses.map((r) => r.status);

    expect(statuses.filter((s) => s === 201)).toHaveLength(1);
    expect(statuses.filter((s) => s === 409)).toHaveLength(9);
    expect(await prisma.booking.count()).toBe(1);
  });
});

describe('regras de criação', () => {
  it('recusa reserva no passado (422)', async () => {
    const past = {
      startsAt: new Date(Date.now() - 120 * MIN).toISOString(),
      endsAt: new Date(Date.now() - 60 * MIN).toISOString(),
    };
    const res = await book(ana, room.id, past);

    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('BOOKING_IN_PAST');
  });

  it('recusa duração fora do limite (422) e fim antes do início (400)', async () => {
    expect((await book(ana, room.id, slot(0, 10))).status).toBe(422);
    expect((await book(ana, room.id, slot(0, 600))).status).toBe(422);
    expect((await book(ana, room.id, slot(60, 0))).status).toBe(400);
  });

  it('recusa data sem fuso horário (400)', async () => {
    const res = await book(ana, room.id, {
      startsAt: '2030-03-12T13:00:00',
      endsAt: '2030-03-12T14:00:00',
    });

    expect(res.status).toBe(400);
  });

  it('recusa sala desativada (404)', async () => {
    const inactive = await createRoom({ active: false });
    const res = await book(ana, inactive.id, slot(0, 60));

    expect(res.status).toBe(404);
  });
});

describe('cancelamento', () => {
  it('libera o horário para outra pessoa', async () => {
    const created = await book(ana, room.id, slot(0, 60));

    const canceled = await cancel(ana, created.body.data.id);
    expect(canceled.status).toBe(200);
    expect(canceled.body.data.status).toBe('CANCELED');

    const rebooked = await book(bruno, room.id, slot(0, 60));
    expect(rebooked.status).toBe(201);
  });

  it('não permite cancelar duas vezes (409)', async () => {
    const created = await book(ana, room.id, slot(0, 60));
    await cancel(ana, created.body.data.id);
    const again = await cancel(ana, created.body.data.id);

    expect(again.status).toBe(409);
    expect(again.body.error.code).toBe('BOOKING_ALREADY_CANCELED');
  });

  it('membro não cancela com menos de 2 horas, admin cancela', async () => {
    const soon = {
      startsAt: new Date(Date.now() + 60 * MIN).toISOString(),
      endsAt: new Date(Date.now() + 120 * MIN).toISOString(),
    };
    const created = await book(ana, room.id, soon);
    expect(created.status).toBe(201);

    const asMember = await cancel(ana, created.body.data.id);
    expect(asMember.status).toBe(422);
    expect(asMember.body.error.code).toBe('CANCELLATION_TOO_LATE');

    const asAdmin = await cancel(admin, created.body.data.id);
    expect(asAdmin.status).toBe(200);
  });
});

describe('visibilidade por perfil', () => {
  it('membro não enxerga nem cancela reserva alheia (404)', async () => {
    const created = await book(ana, room.id, slot(0, 60));
    const id = created.body.data.id;

    const get = await api().get(`/api/v1/bookings/${id}`).set(authHeader(bruno));
    expect(get.status).toBe(404);
    expect((await cancel(bruno, id)).status).toBe(404);
  });

  it('a listagem do membro traz só as dele, a do admin traz todas', async () => {
    await book(ana, room.id, slot(0, 60));
    await book(bruno, room.id, slot(120, 180));

    const asMember = await api().get('/api/v1/bookings').set(authHeader(ana));
    expect(asMember.body.meta.total).toBe(1);

    const asAdmin = await api().get('/api/v1/bookings').set(authHeader(admin));
    expect(asAdmin.body.meta.total).toBe(2);
    expect(asAdmin.body.data[0].user).toHaveProperty('email');
  });
});
