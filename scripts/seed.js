import argon2 from 'argon2';
import { prisma } from '../src/lib/prisma.js';

if (process.env.NODE_ENV === 'production') {
  console.error('Seed bloqueado em produção.');
  process.exit(1);
}

const email = process.env.SEED_ADMIN_EMAIL ?? 'admin@example.com';
const password = process.env.SEED_ADMIN_PASSWORD ?? 'admin-senha-123';

await prisma.user.upsert({
  where: { email },
  update: { role: 'ADMIN' },
  create: {
    name: 'Administrador',
    email,
    passwordHash: await argon2.hash(password),
    role: 'ADMIN',
  },
});

console.log(`Admin pronto: ${email}`);
await prisma.$disconnect();
