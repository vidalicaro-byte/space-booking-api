import { z } from 'zod';

export const roomIdParamSchema = z.object({ id: z.uuid() });

export const createRoomSchema = z.object({
  name: z.string().trim().min(2).max(100),
  description: z.string().trim().max(500).optional(),
  capacity: z.number().int().min(1).max(1000),
});

export const updateRoomSchema = createRoomSchema
  .partial()
  .extend({ active: z.boolean().optional() })
  .refine((data) => Object.keys(data).length > 0, {
    message: 'Informe ao menos um campo para atualizar',
  });

export const listRoomsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),
  search: z.string().trim().min(1).optional(),
  minCapacity: z.coerce.number().int().min(1).optional(),
  active: z
    .enum(['true', 'false'])
    .transform((value) => value === 'true')
    .optional(),
});
