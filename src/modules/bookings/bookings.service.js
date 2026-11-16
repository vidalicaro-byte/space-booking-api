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
