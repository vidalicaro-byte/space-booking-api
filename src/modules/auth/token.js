import { SignJWT, jwtVerify } from 'jose';
import { env } from '../../config/env.js';
import { createHash, randomBytes } from 'node:crypto';

const secret = new TextEncoder().encode(env.JWT_ACCESS_SECRET);

export function signAccessToken(user) {
  return new SignJWT({ role: user.role })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(user.id)
    .setIssuedAt()
    .setExpirationTime(env.JWT_ACCESS_EXPIRES_IN)
    .sign(secret);
}

export async function verifyAccessToken(token) {
  const { payload } = await jwtVerify(token, secret, { algorithms: ['HS256'] });
  return payload;
}

export const generateRefreshToken = () => randomBytes(48).toString('base64url');

export const hashToken = (token) => createHash('sha256').update(token).digest('hex');
