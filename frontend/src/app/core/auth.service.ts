import { Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Observable, catchError, tap, throwError } from 'rxjs';
import { Router } from '@angular/router';
import { environment } from '../../environments/environment';

export const TOKEN_KEY = 'access_token';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private base = this.resolveInitialBase();
  private readonly sameOriginBase = this.shouldUseSameOriginFallback() ? this.getSameOriginApiUrl() : '';

  constructor(private http: HttpClient, private router: Router) {}

  login(email: string, password: string): Observable<{ access_token: string }> {
    const payload = { email: email.trim(), password: password.trim() };
    return this.http.post<{ access_token: string }>(this.buildUrl(this.base, 'auth/login'), payload).pipe(
      catchError((err: HttpErrorResponse) => {
        if (err.status !== 0 || !this.sameOriginBase || this.sameOriginBase === this.base) {
          return throwError(() => err);
        }

        return this.http.post<{ access_token: string }>(this.buildUrl(this.sameOriginBase, 'auth/login'), payload).pipe(
          tap(() => {
            this.base = this.sameOriginBase;
          }),
        );
      }),
      tap(res => localStorage.setItem(TOKEN_KEY, res.access_token)),
    );
  }

  logout(): void {
    localStorage.removeItem(TOKEN_KEY);
    this.router.navigateByUrl('/login');
  }

  isLoggedIn(): boolean {
    return !!localStorage.getItem(TOKEN_KEY);
  }

  private resolveInitialBase(): string {
    if (typeof window === 'undefined') {
      return environment.apiUrl.replace(/\/+$/, '');
    }

    const runtimeApiUrl = (window as any).__API_URL__;
    const configured = String(runtimeApiUrl || environment.apiUrl || '').trim();
    if (configured) {
      return configured.replace(/\/+$/, '');
    }

    return this.getSameOriginApiUrl() || '/api';
  }

  private getSameOriginApiUrl(): string {
    if (typeof window === 'undefined') return '';
    return `${window.location.origin}/api`;
  }

  private shouldUseSameOriginFallback(): boolean {
    return !environment.production;
  }

  private buildUrl(base: string, path: string): string {
    return `${base.replace(/\/+$/, '')}/${path.replace(/^\/+/, '')}`;
  }
}
