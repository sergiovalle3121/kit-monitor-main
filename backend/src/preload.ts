import { webcrypto } from 'crypto';

/**
 * Railway (Node 18) no expone `global.crypto` por defecto.
 * TypeORM (Nest) lo usa internamente -> ponemos un polyfill.
 */
if (!(global as any).crypto) {
  (global as any).crypto = webcrypto as unknown as Crypto;
}
