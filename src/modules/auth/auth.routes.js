import { Router } from 'express';
import { validateBody } from '../../middlewares/validate.js';
import { authenticate } from '../../middlewares/auth.js';
import { loginSchema, refreshSchema, registerSchema } from './auth.schemas.js';
import { login, logout, me, refresh, register } from './auth.controller.js';
import { loginLimiter, registerLimiter } from '../../middlewares/rate-limit.js';

export const authRouter = Router();

authRouter.post('/register', registerLimiter, validateBody(registerSchema), register);
authRouter.post('/login', loginLimiter, validateBody(loginSchema), login);
authRouter.get('/me', authenticate, me);
authRouter.post('/refresh', validateBody(refreshSchema), refresh);
authRouter.post('/logout', validateBody(refreshSchema), logout);
