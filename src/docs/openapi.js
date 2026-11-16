import { z } from 'zod';
import { loginSchema, refreshSchema, registerSchema } from '../modules/auth/auth.schemas.js';
import { createBookingSchema } from '../modules/bookings/bookings.schemas.js';
import { createRoomSchema, updateRoomSchema } from '../modules/rooms/rooms.schemas.js';

// Descreve o corpo a partir do schema Zod REAL (mesmo que valida a entrada).
// io: 'input' = formato que o cliente envia, antes das transformações.
function fromZod(schema) {
  const jsonSchema = z.toJSONSchema(schema, { io: 'input', unrepresentable: 'any' });
  delete jsonSchema.$schema;
  return jsonSchema;
}

const ref = (name) => ({ $ref: `#/components/schemas/${name}` });
const refResponse = (name) => ({ $ref: `#/components/responses/${name}` });

const body = (schema, example) => ({
  required: true,
  content: { 'application/json': { schema: fromZod(schema), example } },
});

const json = (description, schema) => ({
  description,
  content: { 'application/json': { schema } },
});

const data = (schema) => ({ type: 'object', required: ['data'], properties: { data: schema } });

const paged = (schema) => ({
  type: 'object',
  required: ['data', 'meta'],
  properties: { data: { type: 'array', items: schema }, meta: ref('PaginationMeta') },
});

const errors = {
  400: refResponse('ValidationError'),
  401: refResponse('Unauthorized'),
  403: refResponse('Forbidden'),
  404: refResponse('NotFound'),
  409: refResponse('Conflict'),
  422: refResponse('BusinessRule'),
  429: refResponse('TooManyRequests'),
};
const errs = (...codes) => Object.fromEntries(codes.map((code) => [code, errors[code]]));

const bearer = [{ bearerAuth: [] }];

const idParam = {
  name: 'id',
  in: 'path',
  required: true,
  schema: { type: 'string', format: 'uuid' },
};

const query = (name, schema, description) => ({
  name,
  in: 'query',
  required: false,
  schema,
  description,
});

const pagination = [
  query('page', { type: 'integer', minimum: 1, default: 1 }, 'Página (começa em 1)'),
  query(
    'limit',
    { type: 'integer', minimum: 1, maximum: 100, default: 10 },
    'Itens por página (máx. 100)',
  ),
];

const bookingExample = {
  roomId: '00000000-0000-4000-8000-000000000000',
  startsAt: '2027-03-10T13:00:00-03:00',
  endsAt: '2027-03-10T14:00:00-03:00',
};

const paths = {
  '/auth/register': {
    post: {
      tags: ['Auth'],
      summary: 'Cadastrar usuário',
      description:
        'Cria uma conta com perfil MEMBER. Campos desconhecidos (como `role`) são ignorados.',
      requestBody: body(registerSchema, {
        name: 'Ana Souza',
        email: 'ana@example.com',
        password: 'senha-forte-123',
      }),
      responses: { 201: json('Usuário criado', data(ref('User'))), ...errs(400, 409, 429) },
    },
  },
  '/auth/login': {
    post: {
      tags: ['Auth'],
      summary: 'Fazer login',
      description:
        'Devolve um access token (JWT, 15 min) e um refresh token. Limite: 10 tentativas falhas por 15 min por IP.',
      requestBody: body(loginSchema, { email: 'ana@example.com', password: 'senha-forte-123' }),
      responses: { 200: json('Sessão iniciada', data(ref('Session'))), ...errs(400, 401, 429) },
    },
  },
  '/auth/refresh': {
    post: {
      tags: ['Auth'],
      summary: 'Renovar sessão',
      description:
        'Troca um refresh token por um par novo (rotação). Reusar um token já usado revoga toda a sessão.',
      requestBody: body(refreshSchema, { refreshToken: 'cole-aqui-o-refresh-token' }),
      responses: { 200: json('Novo par de tokens', data(ref('Tokens'))), ...errs(400, 401) },
    },
  },
  '/auth/logout': {
    post: {
      tags: ['Auth'],
      summary: 'Encerrar sessão',
      description: 'Revoga o refresh token informado.',
      requestBody: body(refreshSchema, { refreshToken: 'cole-aqui-o-refresh-token' }),
      responses: { 204: { description: 'Sessão encerrada' }, ...errs(400) },
    },
  },
  '/auth/me': {
    get: {
      tags: ['Auth'],
      summary: 'Dados do usuário logado',
      security: bearer,
      responses: { 200: json('Usuário', data(ref('User'))), ...errs(401) },
    },
  },
  '/rooms': {
    get: {
      tags: ['Rooms'],
      summary: 'Listar salas',
      description: 'Membros veem só salas ativas. Admins veem todas e podem filtrar por `active`.',
      security: bearer,
      parameters: [
        ...pagination,
        query('search', { type: 'string' }, 'Busca parcial pelo nome (sem diferenciar maiúsculas)'),
        query('minCapacity', { type: 'integer', minimum: 1 }, 'Capacidade mínima'),
        query('active', { type: 'boolean' }, 'Filtro por ativa/inativa (só tem efeito para admin)'),
      ],
      responses: { 200: json('Lista paginada', paged(ref('Room'))), ...errs(400, 401) },
    },
    post: {
      tags: ['Rooms'],
      summary: 'Criar sala',
      description: 'Apenas admin.',
      security: bearer,
      requestBody: body(createRoomSchema, {
        name: 'Sala Alfa',
        description: 'Sala com projetor',
        capacity: 10,
      }),
      responses: { 201: json('Sala criada', data(ref('Room'))), ...errs(400, 401, 403, 409) },
    },
  },
  '/rooms/{id}': {
    get: {
      tags: ['Rooms'],
      summary: 'Buscar sala por id',
      description: 'Sala inativa só é visível para admin (para os demais, responde 404).',
      security: bearer,
      parameters: [idParam],
      responses: { 200: json('Sala', data(ref('Room'))), ...errs(400, 401, 404) },
    },
    patch: {
      tags: ['Rooms'],
      summary: 'Atualizar sala',
      description: 'Apenas admin. Envie só os campos que mudam; pode reativar com `active: true`.',
      security: bearer,
      parameters: [idParam],
      requestBody: body(updateRoomSchema, { capacity: 12 }),
      responses: {
        200: json('Sala atualizada', data(ref('Room'))),
        ...errs(400, 401, 403, 404, 409),
      },
    },
    delete: {
      tags: ['Rooms'],
      summary: 'Desativar sala',
      description:
        'Apenas admin. Não apaga: marca como inativa, preservando o histórico de reservas.',
      security: bearer,
      parameters: [idParam],
      responses: { 204: { description: 'Sala desativada' }, ...errs(400, 401, 403, 404) },
    },
  },
  '/bookings': {
    get: {
      tags: ['Bookings'],
      summary: 'Listar reservas',
      description:
        'Membros veem só as próprias. Admins veem todas (com os dados de quem reservou) e podem filtrar por `userId`.',
      security: bearer,
      parameters: [
        ...pagination,
        query('status', { type: 'string', enum: ['CONFIRMED', 'CANCELED'] }, 'Filtro por status'),
        query('roomId', { type: 'string', format: 'uuid' }, 'Filtro por sala'),
        query('userId', { type: 'string', format: 'uuid' }, 'Filtro por usuário (só admin)'),
        query(
          'from',
          { type: 'string', format: 'date-time' },
          'Início do período (com fuso, ex.: ...Z)',
        ),
        query(
          'to',
          { type: 'string', format: 'date-time' },
          'Fim do período (com fuso, ex.: ...Z)',
        ),
      ],
      responses: { 200: json('Lista paginada', paged(ref('Booking'))), ...errs(400, 401) },
    },
    post: {
      tags: ['Bookings'],
      summary: 'Criar reserva',
      description:
        'Regras: começa no futuro, duração entre 15 min e 8 h, datas com fuso horário. ' +
        'Conflito de horário na mesma sala é barrado pelo banco (exclusion constraint) e devolve 409.',
      security: bearer,
      requestBody: body(createBookingSchema, bookingExample),
      responses: {
        201: json('Reserva criada', data(ref('Booking'))),
        ...errs(400, 401, 404, 409, 422),
      },
    },
  },
  '/bookings/{id}': {
    get: {
      tags: ['Bookings'],
      summary: 'Buscar reserva por id',
      description: 'Membro só acessa as próprias; a de outra pessoa responde 404.',
      security: bearer,
      parameters: [idParam],
      responses: { 200: json('Reserva', data(ref('Booking'))), ...errs(400, 401, 404) },
    },
  },
  '/bookings/{id}/cancel': {
    post: {
      tags: ['Bookings'],
      summary: 'Cancelar reserva',
      description:
        'Membro cancela com no mínimo 2 h de antecedência; admin, a qualquer momento antes do início. ' +
        'O horário volta a ficar livre.',
      security: bearer,
      parameters: [idParam],
      responses: {
        200: json('Reserva cancelada', data(ref('Booking'))),
        ...errs(400, 401, 404, 409, 422),
      },
    },
  },
};

const uuid = { type: 'string', format: 'uuid' };
const dateTime = { type: 'string', format: 'date-time' };

const schemas = {
  Error: {
    type: 'object',
    required: ['error'],
    properties: {
      error: {
        type: 'object',
        required: ['code', 'message'],
        properties: {
          code: { type: 'string', example: 'VALIDATION_ERROR' },
          message: { type: 'string' },
          details: {
            type: 'array',
            items: {
              type: 'object',
              properties: { field: { type: 'string' }, message: { type: 'string' } },
            },
          },
        },
      },
    },
  },
  PaginationMeta: {
    type: 'object',
    required: ['page', 'limit', 'total', 'totalPages'],
    properties: {
      page: { type: 'integer' },
      limit: { type: 'integer' },
      total: { type: 'integer' },
      totalPages: { type: 'integer' },
    },
  },
  User: {
    type: 'object',
    required: ['id', 'name', 'email', 'role'],
    properties: {
      id: uuid,
      name: { type: 'string' },
      email: { type: 'string', format: 'email' },
      role: { type: 'string', enum: ['ADMIN', 'MEMBER'] },
      createdAt: dateTime,
    },
  },
  Tokens: {
    type: 'object',
    required: ['accessToken', 'refreshToken'],
    properties: { accessToken: { type: 'string' }, refreshToken: { type: 'string' } },
  },
  Session: {
    type: 'object',
    required: ['user', 'accessToken', 'refreshToken'],
    properties: {
      user: ref('User'),
      accessToken: { type: 'string' },
      refreshToken: { type: 'string' },
    },
  },
  Room: {
    type: 'object',
    required: ['id', 'name', 'capacity', 'active'],
    properties: {
      id: uuid,
      name: { type: 'string' },
      description: { type: ['string', 'null'] },
      capacity: { type: 'integer' },
      active: { type: 'boolean' },
      createdAt: dateTime,
      updatedAt: dateTime,
    },
  },
  Booking: {
    type: 'object',
    required: ['id', 'userId', 'roomId', 'startsAt', 'endsAt', 'status'],
    properties: {
      id: uuid,
      userId: uuid,
      roomId: uuid,
      startsAt: { ...dateTime, description: 'Sempre em UTC; o cliente converte para o fuso local' },
      endsAt: dateTime,
      status: { type: 'string', enum: ['CONFIRMED', 'CANCELED'] },
      createdAt: dateTime,
      updatedAt: dateTime,
      room: {
        type: 'object',
        properties: { id: uuid, name: { type: 'string' } },
      },
      user: {
        description: 'Presente apenas na listagem de admin',
        type: 'object',
        properties: { id: uuid, name: { type: 'string' }, email: { type: 'string' } },
      },
    },
  },
};

const errorResponse = (description) => ({
  description,
  content: { 'application/json': { schema: ref('Error') } },
});

const responses = {
  ValidationError: errorResponse(
    'Dados inválidos (`VALIDATION_ERROR`, com a lista de campos em `details`)',
  ),
  Unauthorized: errorResponse('Token ausente, inválido ou expirado'),
  Forbidden: errorResponse('Sem permissão para esta ação (`FORBIDDEN`)'),
  NotFound: errorResponse('Recurso não encontrado'),
  Conflict: errorResponse(
    'Conflito com o estado atual (e-mail/nome já usado, horário ocupado, já cancelada)',
  ),
  BusinessRule: errorResponse(
    'Regra de negócio violada (reserva no passado, duração inválida, cancelamento tardio)',
  ),
  TooManyRequests: errorResponse('Limite de requisições excedido (`RATE_LIMITED`)'),
};

export const openApiDocument = {
  openapi: '3.1.0',
  info: {
    title: 'Space Booking API',
    version: '0.1.0',
    description:
      'API REST de reservas de salas e espaços.\n\n' +
      'Para testar rotas protegidas: faça login em `POST /auth/login`, copie o `accessToken`, ' +
      'clique em **Authorize** e cole só o token (sem a palavra Bearer).',
  },
  servers: [{ url: '/api/v1' }],
  tags: [
    { name: 'Auth', description: 'Cadastro, login e sessão' },
    { name: 'Rooms', description: 'Salas e espaços' },
    { name: 'Bookings', description: 'Reservas com bloqueio de conflito de horário' },
  ],
  paths,
  components: {
    securitySchemes: { bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' } },
    schemas,
    responses,
  },
};
