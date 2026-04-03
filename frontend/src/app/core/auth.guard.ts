import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { TOKEN_KEY } from './auth.service';

function decodePayload(token: string): { exp?: number } | null {
  const parts = token.split('.');
  if (parts.length !== 3) return null;

  try {
    const base64 = parts[1]
      .replace(/-/g, '+')
      .replace(/_/g, '/')
      .padEnd(Math.ceil(parts[1].length / 4) * 4, '=');

    return JSON.parse(atob(base64));
  } catch {
    return null;
  }
}

function isUsableToken(token: string): boolean {
  const payload = decodePayload(token);
  if (!payload) return false;
  if (typeof payload.exp === 'number' && Date.now() >= payload.exp * 1000) return false;
  return true;
}

export const authGuard: CanActivateFn = () => {
  const router = inject(Router);
  const token = typeof localStorage !== 'undefined' ? localStorage.getItem(TOKEN_KEY) : null;

  if (token && isUsableToken(token)) return true;

  if (token) {
    localStorage.removeItem(TOKEN_KEY);
  }

  return router.createUrlTree(['/login']);
};
