import { z } from 'zod';

// Exige fuso explícito (Z ou -03:00): "2027-03-10T13:00:00" sem fuso é ambíguo e é rejeitado
const isoDate = z.iso.datetime({ offset: true }).transform((value) => new Date(value));

export const createBookingSchema = z
  .object({
    roomId: z.uuid(),
    startsAt: isoDate,
    endsAt: isoDate,
  })
  .refine((data) => data.endsAt > data.startsAt, {
    message: 'endsAt deve ser posterior a startsAt',
    path: ['endsAt'],
  });

export const bookingIdParamSchema = z.object({ id: z.uuid() });

export const listBookingsQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(10),
    status: z.enum(['CONFIRMED', 'CANCELED']).optional(),
    roomId: z.uuid().optional(),
    userId: z.uuid().optional(), // só tem efeito para admin
    from: isoDate.optional(),
    to: isoDate.optional(),
  })
  .refine((data) => !data.from || !data.to || data.to > data.from, {
    message: 'to deve ser posterior a from',
    path: ['to'],
  });
