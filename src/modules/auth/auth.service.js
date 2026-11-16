import { randomUUID } from 'node:crypto';
import argon2 from 'argon2';
import { prisma } from '../../lib/prisma.js';
import { env } from '../../config/env.js';
import { AppError } from '../../shared/errors/app-error.js';
import { generateRefreshToken, hashToken, signAccessToken } from './token.js';

const publicUserFields = { id: true, name: true, email: true, role: true, createdAt: true };

export async function registerUser({ name, email, password }) {
  const passwordHash = await argon2.hash(password);

  try {
    return await prisma.user.create({
      data: { name, email, passwordHash },
      select: publicUserFields,
    });
  } catch (error) {
    // P2002 = violação de constraint unique (e-mail já existe)
    if (error.code === 'P2002') {
      throw new AppError('E-mail já cadastrado', 409, 'EMAIL_IN_USE');
    }
    throw error;
  }
}

// Hash falso usado quando o e-mail não existe, para o tempo de resposta
// ser parecido com o de um e-mail existente (evita descobrir contas pelo tempo)
const DUMMY_HASH = await argon2.hash('senha-invalida-para-equalizar-tempo');

async function issueTokens(user, familyId = randomUUID(), db = prisma) {
  const refreshToken = generateRefreshToken();

  await db.refreshToken.create({
    data: {
      userId: user.id,
      familyId,
      tokenHash: hashToken(refreshToken),
      expiresAt: new Date(Date.now() + env.JWT_REFRESH_EXPIRES_DAYS * 24 * 60 * 60 * 1000),
    },
  });

  const accessToken = await signAccessToken(user);
  return { accessToken, refreshToken };
}

export async function loginUser({ email, password }) {
  const user = await prisma.user.findUnique({ where: { email } });

  const passwordOk = await argon2.verify(user?.passwordHash ?? DUMMY_HASH, password);

  if (!user || !passwordOk) {
    throw new AppError('Credenciais inválidas', 401, 'INVALID_CREDENTIALS');
  }

  const tokens = await issueTokens(user);

  return {
    user: { id: user.id, name: user.name, email: user.email, role: user.role },
    ...tokens,
  };
}

export async function getCurrentUser(userId) {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: publicUserFields });

  if (!user) {
    throw new AppError('Usuário não encontrado', 401, 'UNAUTHORIZED');
  }

  return user;
}

export async function refreshSession(rawToken) {
  const stored = await prisma.refreshToken.findUnique({
    where: { tokenHash: hashToken(rawToken) },
    include: { user: true },
  });

  if (!stored) {
    throw new AppError('Refresh token inválido', 401, 'INVALID_REFRESH_TOKEN');
  }

  // Token já usado ou revogado sendo apresentado de novo: possível roubo.
  // Revoga a família inteira para forçar um novo login.
  if (stored.revokedAt) {
    await prisma.refreshToken.updateMany({
      where: { familyId: stored.familyId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    throw new AppError('Sessão inválida. Faça login novamente.', 401, 'REFRESH_TOKEN_REUSED');
  }

  if (stored.expiresAt <= new Date()) {
    throw new AppError('Refresh token expirado', 401, 'INVALID_REFRESH_TOKEN');
  }

  return prisma.$transaction(async (tx) => {
    // Só revoga se ainda não estiver revogado: se duas requisições chegarem
    // juntas com o mesmo token, apenas uma consegue (count === 1)
    const { count } = await tx.refreshToken.updateMany({
      where: { id: stored.id, revokedAt: null },
      data: { revokedAt: new Date() },
    });

    if (count === 0) {
      throw new AppError('Refresh token inválido', 401, 'INVALID_REFRESH_TOKEN');
    }

    return issueTokens(stored.user, stored.familyId, tx);
  });
}

export async function logoutUser(rawToken) {
  await prisma.refreshToken.updateMany({
    where: { tokenHash: hashToken(rawToken), revokedAt: null },
    data: { revokedAt: new Date() },
  });
}
