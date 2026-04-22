import { HttpInterceptorFn, HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';
import { TOKEN_KEY } from './auth.service';

export const jwtInterceptor: HttpInterceptorFn = (req, next) => {
  const router = inject(Router);
  const token = typeof localStorage !== 'undefined' ? localStorage.getItem(TOKEN_KEY) : null;

  if (token) {
    req = req.clone({ setHeaders: { Authorization: `Bearer ${token}` } });
  }

  return next(req).pipe(
    catchError((err: HttpErrorResponse) => {
      // Auto-logout on 401 (expired/invalid token), but not on login failures
      if (err.status === 401 && !req.url.includes('/auth/login')) {
        localStorage.removeItem(TOKEN_KEY);
        router.navigateByUrl('/login');
      }
      return throwError(() => err);
    }),
  );
};
