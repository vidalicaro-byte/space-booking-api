import { AppError } from '../shared/errors/app-error.js';

export function notFoundHandler(_req, res) {
  res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Rota não encontrada' } });
}

// O Express só reconhece um error handler se ele tiver exatamente 4 parâmetros
export function errorHandler(err, req, res, _next) {
  if (err instanceof AppError) {
    return res.status(err.statusCode).json({
      error: { code: err.code, message: err.message, details: err.details },
    });
  }

  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ error: { code: 'INVALID_JSON', message: 'JSON malformado' } });
  }

  if (err.type === 'entity.too.large') {
    return res
      .status(413)
      .json({ error: { code: 'PAYLOAD_TOO_LARGE', message: 'Corpo da requisição grande demais' } });
  }

  // req.log já carrega o ID da requisição, então o erro fica ligado ao request que o causou
  req.log.error({ err }, 'Erro não tratado');
  res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Erro interno do servidor' } });
}
