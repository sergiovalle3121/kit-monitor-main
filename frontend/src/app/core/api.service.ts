import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

@Injectable({ providedIn: 'root' })
export class ApiService {
  private http = inject(HttpClient);
  private readonly baseUrl = environment.apiUrl ?? 'http://localhost:3000';

  // Helper GET genérico
  get<T>(path: string, params?: Record<string, any>): Observable<T> {
    const url = `${this.baseUrl}${path.startsWith('/') ? path : '/' + path}`;
    let httpParams = new HttpParams();
    if (params) {
      for (const [k, v] of Object.entries(params)) {
        if (v !== undefined && v !== null) httpParams = httpParams.set(k, String(v));
      }
    }
    return this.http.get<T>(url, { params: httpParams });
  }

  // ---- Tu método:
  getKits(): Observable<any[]> {
    return this.get<any[]>('/kits');
  }
}
