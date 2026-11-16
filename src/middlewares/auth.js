import { AppError } from '../shared/errors/app-error.js';
import { verifyAccessToken } from '../modules/auth/token.js';

export async function authenticate(req, _res, next) {
  const header = req.headers.authorization;

  if (!header?.startsWith('Bearer ')) {
    throw new AppError('Token não informado', 401, 'UNAUTHORIZED');
  }

  try {
    const payload = await verifyAccessToken(header.slice(7));
    req.user = { id: payload.sub, role: payload.role };
  } catch {
    throw new AppError('Token inválido ou expirado', 401, 'INVALID_TOKEN');
  }

  next();
}

export const authorize =
  (...roles) =>
  (req, _res, next) => {
    if (!roles.includes(req.user.role)) {
      throw new AppError('Acesso negado', 403, 'FORBIDDEN');
    }
    next();
  };
