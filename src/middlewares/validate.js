import { AppError } from '../shared/errors/app-error.js';

export const validateBody = (schema) => (req, _res, next) => {
  const result = schema.safeParse(req.body);

  if (!result.success) {
    const details = result.error.issues.map((issue) => ({
      field: issue.path.join('.'),
      message: issue.message,
    }));
    throw new AppError('Dados inválidos', 400, 'VALIDATION_ERROR', details);
  }

  req.body = result.data;
  next();
};
