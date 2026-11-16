import { AppError } from '../shared/errors/app-error.js';

const makeValidator = (source) => (schema) => (req, _res, next) => {
  const result = schema.safeParse(req[source]);

  if (!result.success) {
    const details = result.error.issues.map((issue) => ({
      field: issue.path.join('.'),
      message: issue.message,
    }));
    throw new AppError('Dados inválidos', 400, 'VALIDATION_ERROR', details);
  }

  if (source === 'body') {
    req.body = result.data;
  } else {
    req.validated = { ...req.validated, [source]: result.data };
  }
  next();
};

export const validateBody = makeValidator('body');
export const validateQuery = makeValidator('query');
export const validateParams = makeValidator('params');
