import argon2 from 'argon2';
import request from 'supertest';
import { app } from '../src/app.js';
import { env } from '../src/config/env.js';
import { prisma } from '../src/lib/prisma.js';
import { signAccessToken } from '../src/modules/auth/token.js';

export { prisma };
export const api = () => request(app);

export const TEST_PASSWORD = 'senha-forte-123';

// O hash é calculado uma vez só, para criar usuários rapidamente
const PASSWORD_HASH = await argon2.hash(TEST_PASSWORD);

export async function resetDb() {
  if (!new URL(env.DATABASE_URL).pathname.endsWith('_test')) {
    throw new Error('resetDb só pode rodar contra um banco de testes (_test)');
  }
  await prisma.$executeRawUnsafe(
    'TRUNCATE TABLE refresh_tokens, bookings, rooms, users RESTART IDENTITY CASCADE',
  );
}

let userCounter = 0;

export async function createUser({ role = 'MEMBER' } = {}) {
  userCounter += 1;
  const user = await prisma.user.create({
    data: {
      name: `Usuário ${userCounter}`,
      email: `user${userCounter}@test.com`,
      passwordHash: PASSWORD_HASH,
      role,
    },
  });
  // Já devolve um token válido, para os testes não precisarem fazer login toda vez
  return { ...user, token: await signAccessToken(user) };
}

let roomCounter = 0;

export function createRoom(data = {}) {
  roomCounter += 1;
  return prisma.room.create({ data: { name: `Sala ${roomCounter}`, capacity: 10, ...data } });
}

export const authHeader = (user) => ({ Authorization: `Bearer ${user.token}` });
