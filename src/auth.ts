import { randomBytes, createHash } from 'node:crypto';
import bcrypt from 'bcryptjs';

const ACCESS_TTL = process.env.JWT_ACCESS_TTL ?? '15m';
const REFRESH_DAYS = Number(process.env.JWT_REFRESH_DAYS ?? 30);

export function hashPassword(password: string) {
  return bcrypt.hash(password, 10);
}

export function verifyPassword(password: string, hash: string) {
  return bcrypt.compare(password, hash);
}

export function generateRefreshToken() {
  return randomBytes(32).toString('hex');
}

export function hashToken(token: string) {
  return createHash('sha256').update(token).digest('hex');
}

export function getAccessTtl() {
  return ACCESS_TTL;
}

export function getRefreshExpiry() {
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + REFRESH_DAYS);
  return expiresAt;
}
