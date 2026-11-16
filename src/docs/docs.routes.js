import { Router } from 'express';
import helmet from 'helmet';
import swaggerUi from 'swagger-ui-express';
import { openApiDocument } from './openapi.js';

export const docsRouter = Router();

// A página do Swagger UI precisa de scripts e estilos que a CSP padrão do helmet bloqueia.
// Relaxamos a CSP SÓ nesta rota; o resto da API continua com a política restritiva.
docsRouter.use(helmet({ contentSecurityPolicy: false }));

docsRouter.get('/openapi.json', (_req, res) => res.json(openApiDocument));

docsRouter.use(
  '/',
  swaggerUi.serve,
  swaggerUi.setup(openApiDocument, { customSiteTitle: 'Space Booking API · Docs' }),
);
