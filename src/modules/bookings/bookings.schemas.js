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
