import { z } from 'zod';
import { baseEntitySchema, type BaseEntity } from './types';

export type UserRole = 'OPERATOR' | 'MANAGER' | 'ADMIN';

export interface User extends BaseEntity {
  name: string;
  role: UserRole;
  /** Hash do PIN no formato "pbkdf2$<iter>$<saltB64>$<hashB64>". */
  pinHash: string;
}

export const userSchema = baseEntitySchema.extend({
  name: z.string().min(1, 'Nome obrigatório'),
  role: z.enum(['OPERATOR', 'MANAGER', 'ADMIN']),
  pinHash: z.string(),
});

const PBKDF2_ITERATIONS = 100_000;

function toB64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let str = '';
  for (const b of bytes) str += String.fromCharCode(b);
  return btoa(str);
}

function fromB64(b64: string): ArrayBuffer {
  const str = atob(b64);
  const buffer = new ArrayBuffer(str.length);
  const bytes = new Uint8Array(buffer);
  for (let i = 0; i < str.length; i++) bytes[i] = str.charCodeAt(i);
  return buffer;
}

/**
 * Gera o hash de um PIN usando PBKDF2 (Web Crypto).
 * Segurança local — adequada para demo sem backend (ver documentação).
 */
export async function hashPin(pin: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(pin),
    'PBKDF2',
    false,
    ['deriveBits'],
  );
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations: PBKDF2_ITERATIONS, hash: 'SHA-256' },
    key,
    256,
  );
  return `pbkdf2$${PBKDF2_ITERATIONS}$${toB64(salt.buffer)}$${toB64(bits)}`;
}

/** Verifica um PIN contra um hash armazenado. */
export async function verifyPin(pin: string, stored: string): Promise<boolean> {
  const parts = stored.split('$');
  if (parts.length !== 4 || parts[0] !== 'pbkdf2') return false;
  const iterations = Number(parts[1]);
  const salt = fromB64(parts[2]!);
  const expected = parts[3]!;
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(pin),
    'PBKDF2',
    false,
    ['deriveBits'],
  );
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations, hash: 'SHA-256' },
    key,
    256,
  );
  return toB64(bits) === expected;
}
