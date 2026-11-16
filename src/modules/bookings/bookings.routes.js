import { Router } from 'express';
import { authenticate } from '../../middlewares/auth.js';
import { validateBody, validateParams, validateQuery } from '../../middlewares/validate.js';
import {
  bookingIdParamSchema,
  createBookingSchema,
  listBookingsQuerySchema,
} from './bookings.schemas.js';
import { cancel, create, getOne, list } from './bookings.controller.js';

export const bookingsRouter = Router();

bookingsRouter.use(authenticate);

bookingsRouter.post('/', validateBody(createBookingSchema), create);
bookingsRouter.get('/', validateQuery(listBookingsQuerySchema), list);
bookingsRouter.get('/:id', validateParams(bookingIdParamSchema), getOne);
bookingsRouter.post('/:id/cancel', validateParams(bookingIdParamSchema), cancel);
