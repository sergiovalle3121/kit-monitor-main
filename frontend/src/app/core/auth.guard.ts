import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { catchError, map, of } from 'rxjs';
import { TOKEN_KEY } from './auth.service';
import { environment } from '../../environments/environment';

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
  const http = inject(HttpClient);
  const token = typeof localStorage !== 'undefined' ? localStorage.getItem(TOKEN_KEY) : null;

  if (token && isUsableToken(token)) {
    return http.get(`${environment.apiUrl}/auth/profile`).pipe(
      map(() => true),
      catchError(() => {
        localStorage.removeItem(TOKEN_KEY);
        return of(router.createUrlTree(['/login']));
      }),
    );
  }

  if (token) {
    localStorage.removeItem(TOKEN_KEY);
  }

  return router.createUrlTree(['/login']);
};
