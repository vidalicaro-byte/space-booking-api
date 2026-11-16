import argon2 from 'argon2';
import { prisma } from '../../lib/prisma.js';
import { AppError } from '../../shared/errors/app-error.js';
import { signAccessToken } from './token.js';

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

export async function loginUser({ email, password }) {
  const user = await prisma.user.findUnique({ where: { email } });

  const passwordOk = await argon2.verify(user?.passwordHash ?? DUMMY_HASH, password);

  if (!user || !passwordOk) {
    throw new AppError('Credenciais inválidas', 401, 'INVALID_CREDENTIALS');
  }

  const accessToken = await signAccessToken(user);

  return {
    user: { id: user.id, name: user.name, email: user.email, role: user.role },
    accessToken,
  };
}

export async function getCurrentUser(userId) {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: publicUserFields });

  if (!user) {
    throw new AppError('Usuário não encontrado', 401, 'UNAUTHORIZED');
  }

  return user;
}
