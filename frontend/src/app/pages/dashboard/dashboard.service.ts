import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class DashboardService {

  constructor(private http: HttpClient) { }

  getKits(): Observable<any[]> {
    return this.http.get<any[]>('https://kit-monitor-production.up.railway.app/api/kits');
  }

  getReports(): Observable<any[]> {
    return this.http.get<any[]>('https://kit-monitor-production.up.railway.app/api/reports');
  }

  getModels(): Observable<any[]> {
    return this.http.get<any[]>('https://kit-monitor-production.up.railway.app/api/models');
  }

  getHealth(): Observable<string> {
    return this.http.get('https://kit-monitor-production.up.railway.app/health', { responseType: 'text' });
  }

}