import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
  scryptSync,
} from 'crypto';
import { getJwtSecret } from '../../common/config/jwt-secret';

/**
 * Symmetric encryption for per-tenant BYO (bring-your-own) API keys.
 *
 * Keys are encrypted at rest with AES-256-GCM. The encryption key is derived
 * from AI_KEY_SECRET (preferred) or JWT_SECRET (fallback, so it works out of
 * the box on existing deployments). The plaintext API key NEVER leaves the
 * backend in a response — only the last 4 chars are exposed for display.
 */
const SALT = 'axos-ai-byo-key-v1';

function secret(): string {
  // Prefiere AI_KEY_SECRET; si no, usa el MISMO secreto JWT ya validado
  // (getJwtSecret exige uno fuerte en producción).
  return process.env.AI_KEY_SECRET || getJwtSecret();
}

function derivedKey(): Buffer {
  return scryptSync(secret(), SALT, 32);
}

export function encryptSecret(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', derivedKey(), iv);
  const enc = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return 'v1:' + Buffer.concat([iv, tag, enc]).toString('base64');
}

export function decryptSecret(blob: string): string {
  const raw = Buffer.from(blob.replace(/^v1:/, ''), 'base64');
  const iv = raw.subarray(0, 12);
  const tag = raw.subarray(12, 28);
  const enc = raw.subarray(28);
  const decipher = createDecipheriv('aes-256-gcm', derivedKey(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(enc), decipher.final()]).toString(
    'utf8',
  );
}

export function last4(value: string): string {
  return value.slice(-4);
}
