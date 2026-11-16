import { Router } from 'express';
import { authenticate } from '../../middlewares/auth.js';
import { validateBody } from '../../middlewares/validate.js';
import { createBookingSchema } from './bookings.schemas.js';
import { create } from './bookings.controller.js';

export const bookingsRouter = Router();

bookingsRouter.use(authenticate);

bookingsRouter.post('/', validateBody(createBookingSchema), create);
