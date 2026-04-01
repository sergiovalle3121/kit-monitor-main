import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

@Injectable({ providedIn: 'root' })
export class ApiService {
  private http = inject(HttpClient);
  private readonly base = environment.apiUrl;

  private get<T>(path: string, params?: Record<string, any>): Observable<T> {
    const url = `${this.base}/${path}`;
    let httpParams = new HttpParams();
    if (params) {
      for (const [k, v] of Object.entries(params)) {
        if (v !== undefined && v !== null) httpParams = httpParams.set(k, String(v));
      }
    }
    return this.http.get<T>(url, { params: httpParams });
  }

  // ── Plans ────────────────────────────────────────────────
  getPlans(): Observable<any[]> {
    return this.get<any[]>('plans');
  }

  // ── Kits ─────────────────────────────────────────────────
  getKits(): Observable<any[]> {
    return this.get<any[]>('kits');
  }

  // ── BOM ──────────────────────────────────────────────────
  getBom(model?: string): Observable<any[]> {
    return this.get<any[]>('bom', model ? { model } : undefined);
  }

  // ── Advances ─────────────────────────────────────────────
  getAdvances(kitId: number): Observable<any[]> {
    return this.get<any[]>('advances', { kitId });
  }

  // ── Resupplies ───────────────────────────────────────────
  getResupplies(kitId: number): Observable<any[]> {
    return this.get<any[]>('resupplies', { kitId });
  }

  // ── Exceptions ───────────────────────────────────────────
  getExceptions(kitId: number): Observable<any[]> {
    return this.get<any[]>('exceptions', { kitId });
  }
}
