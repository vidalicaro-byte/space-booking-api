import { prisma } from '../../lib/prisma.js';
import { AppError } from '../../shared/errors/app-error.js';

const MIN_DURATION_MS = 15 * 60 * 1000;
const MAX_DURATION_MS = 8 * 60 * 60 * 1000;

// 23P01 é o código do PostgreSQL para "exclusion_violation". Procuramos em vários
// lugares do erro porque o Prisma com driver adapter pode repassá-lo de formas diferentes.
function isOverlapError(error) {
  const text = [error?.code, error?.meta?.code, error?.cause?.code, error?.message].join(' ');
  return text.includes('23P01') || text.includes('bookings_no_overlap');
}

export async function createBooking(userId, { roomId, startsAt, endsAt }) {
  if (startsAt <= new Date()) {
    throw new AppError('A reserva deve começar no futuro', 422, 'BOOKING_IN_PAST');
  }

  const duration = endsAt - startsAt;
  if (duration < MIN_DURATION_MS || duration > MAX_DURATION_MS) {
    throw new AppError('A duração deve ser entre 15 minutos e 8 horas', 422, 'INVALID_DURATION');
  }

  const room = await prisma.room.findUnique({ where: { id: roomId } });
  if (!room || !room.active) {
    throw new AppError('Sala não encontrada ou indisponível', 404, 'ROOM_NOT_FOUND');
  }

  try {
    return await prisma.booking.create({
      data: { userId, roomId, startsAt, endsAt },
      include: { room: { select: { id: true, name: true } } },
    });
  } catch (error) {
    if (isOverlapError(error)) {
      throw new AppError(
        'Já existe uma reserva confirmada nesse horário para esta sala',
        409,
        'BOOKING_CONFLICT',
      );
    }
    throw error;
  }
}

const MIN_CANCEL_NOTICE_MS = 2 * 60 * 60 * 1000;

const roomSummary = { room: { select: { id: true, name: true } } };

export async function listBookings(query, user) {
  const { page, limit, status, roomId, from, to } = query;
  const isAdmin = user.role === 'ADMIN';

  // Membro é sempre limitado às próprias reservas, ignorando o filtro userId
  const userId = isAdmin ? query.userId : user.id;

  // Reserva que se sobrepõe ao período [from, to]
  const where = {
    ...(userId && { userId }),
    ...(status && { status }),
    ...(roomId && { roomId }),
    ...(from && { endsAt: { gt: from } }),
    ...(to && { startsAt: { lt: to } }),
  };

  const include = isAdmin
    ? { ...roomSummary, user: { select: { id: true, name: true, email: true } } }
    : roomSummary;

  const [items, total] = await prisma.$transaction([
    prisma.booking.findMany({
      where,
      include,
      orderBy: { startsAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.booking.count({ where }),
  ]);

  return { items, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
}

async function findAccessibleBooking(id, user) {
  const booking = await prisma.booking.findUnique({ where: { id }, include: roomSummary });

  // Não existe OU é de outra pessoa: mesma resposta, para não vazar a existência
  if (!booking || (user.role !== 'ADMIN' && booking.userId !== user.id)) {
    throw new AppError('Reserva não encontrada', 404, 'BOOKING_NOT_FOUND');
  }
  return booking;
}

export const getBooking = findAccessibleBooking;

export async function cancelBooking(id, user) {
  const booking = await findAccessibleBooking(id, user);

  if (booking.status === 'CANCELED') {
    throw new AppError('Reserva já cancelada', 409, 'BOOKING_ALREADY_CANCELED');
  }

  const untilStart = booking.startsAt.getTime() - Date.now();

  if (untilStart <= 0) {
    throw new AppError(
      'Não é possível cancelar uma reserva que já começou',
      422,
      'BOOKING_ALREADY_STARTED',
    );
  }

  if (user.role !== 'ADMIN' && untilStart < MIN_CANCEL_NOTICE_MS) {
    throw new AppError(
      'Cancelamento exige no mínimo 2 horas de antecedência',
      422,
      'CANCELLATION_TOO_LATE',
    );
  }

  // Condição no WHERE: se duas requisições cancelarem juntas, só uma altera a linha
  const { count } = await prisma.booking.updateMany({
    where: { id, status: 'CONFIRMED' },
    data: { status: 'CANCELED' },
  });

  if (count === 0) {
    throw new AppError('Reserva já cancelada', 409, 'BOOKING_ALREADY_CANCELED');
  }

  return prisma.booking.findUnique({ where: { id }, include: roomSummary });
}
