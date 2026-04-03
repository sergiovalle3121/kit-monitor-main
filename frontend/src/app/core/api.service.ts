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
      for (const [key, value] of Object.entries(params)) {
        if (value !== undefined && value !== null) {
          httpParams = httpParams.set(key, String(value));
        }
      }
    }
    return this.http.get<T>(url, { params: httpParams });
  }

  private post<T>(path: string, body: any): Observable<T> {
    return this.http.post<T>(`${this.base}/${path}`, body);
  }

  private patch<T>(path: string, body: any): Observable<T> {
    return this.http.patch<T>(`${this.base}/${path}`, body);
  }

  private delete<T>(path: string): Observable<T> {
    return this.http.delete<T>(`${this.base}/${path}`);
  }

  getPlans(): Observable<any[]> {
    return this.get<any[]>('plans');
  }

  createPlan(dto: any): Observable<any> {
    return this.post<any>('plans', dto);
  }

  deletePlan(id: number): Observable<any> {
    return this.delete<any>(`plans/${id}`);
  }

  getKits(): Observable<any[]> {
    return this.get<any[]>('kits');
  }

  createKit(planId: number): Observable<any> {
    return this.post<any>('kits', { planId });
  }

  startKit(id: number): Observable<any> {
    return this.patch<any>(`kits/${id}/start`, {});
  }

  updateKitStatus(id: number, status: string): Observable<any> {
    return this.patch<any>(`kits/${id}/status`, { status });
  }

  getBom(model?: string): Observable<any[]> {
    return this.get<any[]>('bom', model ? { model } : undefined);
  }

  getBayLayouts(model: string): Observable<any[]> {
    return this.get<any[]>('bay-layouts', { model });
  }

  createBomItem(dto: any): Observable<any> {
    return this.post<any>('bom', dto);
  }

  importBom(file: File): Observable<any> {
    const fd = new FormData();
    fd.append('file', file);
    return this.http.post<any>(`${this.base}/bom/import`, fd);
  }

  importBomCatalog(file: File): Observable<any> {
    const fd = new FormData();
    fd.append('file', file);
    return this.http.post<any>(`${this.base}/bom/catalog/import`, fd);
  }

  getAdvances(kitId: number): Observable<any[]> {
    return this.get<any[]>('advances', { kitId });
  }

  createAdvance(kitId: number, unitsAssembled: number, notes?: string): Observable<any> {
    return this.post<any>('advances', { kitId, unitsAssembled, notes });
  }

  getResupplies(kitId: number): Observable<any[]> {
    return this.get<any[]>('resupplies', { kitId });
  }

  createResupply(kitId: number, partNumber: string, qty: number, description?: string, reason?: string): Observable<any> {
    return this.post<any>('resupplies', {
      kitId,
      partNumber,
      quantityRequested: qty,
      description,
      reason,
    });
  }

  deliverResupply(id: number, qty: number): Observable<any> {
    return this.patch<any>(`resupplies/${id}/deliver`, { quantityDelivered: qty });
  }

  updatePlan(id: number, dto: any): Observable<any> {
    return this.patch<any>(`plans/${id}`, dto);
  }

  updateKitMaterial(id: number, dto: any): Observable<any> {
    return this.patch<any>(`kit-materials/${id}`, dto);
  }

  getExceptions(kitId: number): Observable<any[]> {
    return this.get<any[]>('exceptions', { kitId });
  }

  createException(kitId: number, type: string, description: string, partNumber?: string): Observable<any> {
    return this.post<any>('exceptions', { kitId, type, description, partNumber });
  }

  resolveException(id: number): Observable<any> {
    return this.patch<any>(`exceptions/${id}/resolve`, {});
  }
}
