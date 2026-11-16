import argon2 from 'argon2';
import { prisma } from '../../lib/prisma.js';
import { AppError } from '../../shared/errors/app-error.js';

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
