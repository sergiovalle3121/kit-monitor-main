/**
 * Fuente única y validada del secreto JWT.
 *
 * - Devuelve `process.env.JWT_SECRET` si existe y tiene al menos 16 caracteres.
 * - En producción lanza un Error (impide arrancar) si falta o es débil, para que
 *   nunca se firmen tokens con un secreto conocido/por defecto.
 * - Solo en desarrollo cae a un default explícito e inseguro.
 */
export function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (secret && secret.length >= 16) {
    return secret;
  }
  if (process.env.NODE_ENV === 'production') {
    throw new Error(
      'JWT_SECRET ausente o demasiado débil (mínimo 16 caracteres). ' +
        'Define un JWT_SECRET fuerte en producción.',
    );
  }
  return 'dev-only-insecure-secret-change-me';
}
