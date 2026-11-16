import { Router } from 'express';
import { authenticate, authorize } from '../../middlewares/auth.js';
import { validateBody, validateParams, validateQuery } from '../../middlewares/validate.js';
import {
  createRoomSchema,
  listRoomsQuerySchema,
  roomIdParamSchema,
  updateRoomSchema,
} from './rooms.schemas.js';
import { create, getOne, list, remove, update } from './rooms.controller.js';

export const roomsRouter = Router();

roomsRouter.use(authenticate);

roomsRouter.get('/', validateQuery(listRoomsQuerySchema), list);
roomsRouter.get('/:id', validateParams(roomIdParamSchema), getOne);

roomsRouter.post('/', authorize('ADMIN'), validateBody(createRoomSchema), create);
roomsRouter.patch(
  '/:id',
  authorize('ADMIN'),
  validateParams(roomIdParamSchema),
  validateBody(updateRoomSchema),
  update,
);
roomsRouter.delete('/:id', authorize('ADMIN'), validateParams(roomIdParamSchema), remove);
