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

  private post<T>(path: string, body: any): Observable<T> {
    return this.http.post<T>(`${this.base}/${path}`, body);
  }

  // ── Plans ────────────────────────────────────────────────
  getPlans(): Observable<any[]>             { return this.get<any[]>('plans'); }
  createPlan(dto: any): Observable<any>     { return this.post<any>('plans', dto); }

  // ── Kits ─────────────────────────────────────────────────
  getKits(): Observable<any[]>              { return this.get<any[]>('kits'); }
  createKit(planId: number): Observable<any>{ return this.post<any>('kits', { planId }); }

  // ── BOM ──────────────────────────────────────────────────
  getBom(model?: string): Observable<any[]> {
    return this.get<any[]>('bom', model ? { model } : undefined);
  }
  createBomItem(dto: any): Observable<any>  { return this.post<any>('bom', dto); }
  importBom(file: File): Observable<any> {
    const fd = new FormData();
    fd.append('file', file);
    return this.http.post<any>(`${this.base}/bom/import`, fd);
  }

  // ── Advances ─────────────────────────────────────────────
  getAdvances(kitId: number): Observable<any[]> {
    return this.get<any[]>('advances', { kitId });
  }
  createAdvance(kitId: number, unitsAssembled: number, notes?: string): Observable<any> {
    return this.post<any>('advances', { kitId, unitsAssembled, notes });
  }

  // ── Resupplies ───────────────────────────────────────────
  getResupplies(kitId: number): Observable<any[]> {
    return this.get<any[]>('resupplies', { kitId });
  }
  createResupply(kitId: number, partNumber: string, qty: number): Observable<any> {
    return this.post<any>('resupplies', { kitId, partNumber, quantityRequested: qty });
  }
  deliverResupply(id: number, qty: number): Observable<any> {
    return this.http.patch<any>(`${this.base}/resupplies/${id}/deliver`, { quantityDelivered: qty });
  }

  // ── Kit status transitions ────────────────────────────────
  updateKitStatus(id: number, status: string): Observable<any> {
    return this.http.patch<any>(`${this.base}/kits/${id}/status`, { status });
  }

  // ── Plan updates ─────────────────────────────────────────
  updatePlan(id: number, dto: any): Observable<any> {
    return this.http.patch<any>(`${this.base}/plans/${id}`, dto);
  }

  // ── Exceptions ───────────────────────────────────────────
  getExceptions(kitId: number): Observable<any[]> {
    return this.get<any[]>('exceptions', { kitId });
  }
  createException(kitId: number, type: string, description: string, partNumber?: string): Observable<any> {
    return this.post<any>('exceptions', { kitId, type, description, partNumber });
  }
  resolveException(id: number): Observable<any> {
    return this.http.patch<any>(`${this.base}/exceptions/${id}/resolve`, {});
  }
}
