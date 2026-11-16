import { prisma } from '../../lib/prisma.js';
import { AppError } from '../../shared/errors/app-error.js';

function translateDbError(error) {
  if (error.code === 'P2002') {
    throw new AppError('Já existe uma sala com esse nome', 409, 'ROOM_NAME_IN_USE');
  }
  if (error.code === 'P2025') {
    throw new AppError('Sala não encontrada', 404, 'ROOM_NOT_FOUND');
  }
  throw error;
}

export async function listRooms(query, user) {
  const { page, limit, search, minCapacity } = query;
  // Membros só veem salas ativas, independente do filtro enviado
  const active = user.role === 'ADMIN' ? query.active : true;

  const where = {
    ...(active !== undefined && { active }),
    ...(minCapacity && { capacity: { gte: minCapacity } }),
    ...(search && { name: { contains: search, mode: 'insensitive' } }),
  };

  const [items, total] = await prisma.$transaction([
    prisma.room.findMany({
      where,
      orderBy: { name: 'asc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.room.count({ where }),
  ]);

  return { items, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
}

export async function getRoom(id, user) {
  const room = await prisma.room.findUnique({ where: { id } });

  // Sala inativa "não existe" para quem não é admin
  if (!room || (!room.active && user.role !== 'ADMIN')) {
    throw new AppError('Sala não encontrada', 404, 'ROOM_NOT_FOUND');
  }
  return room;
}

export async function createRoom(data) {
  try {
    return await prisma.room.create({ data });
  } catch (error) {
    translateDbError(error);
  }
}

export async function updateRoom(id, data) {
  try {
    return await prisma.room.update({ where: { id }, data });
  } catch (error) {
    translateDbError(error);
  }
}

export async function deactivateRoom(id) {
  try {
    await prisma.room.update({ where: { id }, data: { active: false } });
  } catch (error) {
    translateDbError(error);
  }
}
