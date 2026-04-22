import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpErrorResponse, HttpParams } from '@angular/common/http';
import { Observable, catchError, tap, throwError } from 'rxjs';
import { environment } from '../../environments/environment';

@Injectable({ providedIn: 'root' })
export class ApiService {
  private http = inject(HttpClient);
  private base = this.resolveInitialBase();
  private readonly sameOriginBase = this.getSameOriginApiUrl();

  private get<T>(path: string, params?: Record<string, any>): Observable<T> {
    return this.withFallback((base) => {
      const url = this.buildUrl(base, path);
      let httpParams = new HttpParams();
      if (params) {
        for (const [key, value] of Object.entries(params)) {
          if (value !== undefined && value !== null) {
            httpParams = httpParams.set(key, String(value));
          }
        }
      }
      return this.http.get<T>(url, { params: httpParams });
    });
  }

  private post<T>(path: string, body: any): Observable<T> {
    return this.withFallback((base) => this.http.post<T>(this.buildUrl(base, path), body));
  }

  private patch<T>(path: string, body: any): Observable<T> {
    return this.withFallback((base) => this.http.patch<T>(this.buildUrl(base, path), body));
  }

  private delete<T>(path: string): Observable<T> {
    return this.withFallback((base) => this.http.delete<T>(this.buildUrl(base, path)));
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

  getVisualAids(): Observable<any[]> {
    return this.get<any[]>('visual-aids');
  }

  createVisualAid(dto: any): Observable<any> {
    return this.post<any>('visual-aids', dto);
  }

  createVisualAidFormData(formData: FormData): Observable<any> {
    return this.withFallback((base) => this.http.post<any>(this.buildUrl(base, 'visual-aids'), formData));
  }

  updateVisualAid(id: string, dto: any): Observable<any> {
    return this.patch<any>(`visual-aids/${encodeURIComponent(id)}`, dto);
  }

  deleteVisualAid(id: string): Observable<any> {
    return this.delete<any>(`visual-aids/${encodeURIComponent(id)}`);
  }

  getBayLayouts(model: string): Observable<any[]> {
    return this.get<any[]>('bay-layouts', { model });
  }

  createBayLayoutsBulk(rows: Array<{ model: string; partNumber: string; bahia: number }>): Observable<any[]> {
    return this.post<any[]>('bay-layouts/bulk', rows);
  }

  deleteBayLayoutsByModel(model: string): Observable<{ deleted: number }> {
    return this.delete<{ deleted: number }>(`bay-layouts/model/${encodeURIComponent(model)}`);
  }

  createBomItem(dto: any): Observable<any> {
    return this.post<any>('bom', dto);
  }

  importBom(file: File): Observable<any> {
    const fd = new FormData();
    fd.append('file', file);
    return this.withFallback((base) => this.http.post<any>(this.buildUrl(base, 'bom/import'), fd));
  }

  importBomCatalog(file: File): Observable<any> {
    const fd = new FormData();
    fd.append('file', file);
    return this.withFallback((base) => this.http.post<any>(this.buildUrl(base, 'bom/catalog/import'), fd));
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

  getAllResupplies(): Observable<any[]> {
    return this.get<any[]>('resupplies');
  }

  updateResupplyStatus(
    id: number,
    dto: { status: string; actorName: string; quantityDelivered?: number; reason?: string },
  ): Observable<any> {
    return this.patch<any>(`resupplies/${id}/status`, dto);
  }


  assignResupplyOwner(
    id: number,
    dto: { ownerId?: string; ownerName: string; actorName?: string },
  ): Observable<any> {
    return this.patch<any>(`resupplies/${id}/owner`, dto);
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


  getProductionBackends(): Observable<any[]> {
    return this.get<any[]>('production/lines');
  }

  getProductionBackend(kitId: number): Observable<any> {
    return this.get<any>(`production/lines/${kitId}`);
  }

  receiveProductionBackend(kitId: number): Observable<any> {
    return this.post<any>(`production/lines/${kitId}/receive`, {});
  }

  startProductionBackend(kitId: number): Observable<any> {
    return this.post<any>(`production/lines/${kitId}/start`, {});
  }

  createBayEvent(kitId: number, bayId: number, dto: { quantity: number; notes?: string; operator?: string; clientRequestId: string }): Observable<any> {
    return this.post<any>(`production/lines/${kitId}/bays/${bayId}/events`, dto);
  }

  revertProductionEvent(eventId: number): Observable<any> {
    return this.post<any>(`production/events/${eventId}/revert`, {});
  }

  getLedgerEvents(referenceType: string, referenceId: string | number): Observable<any[]> {
    return this.get<any[]>(`ledger/reference/${referenceType}/${referenceId}`);
  }

  getProductionEvents(kitId: number): Observable<any[]> {
    return this.get<any[]>(`production/lines/${kitId}/events`);
  }

  createProductionIncident(
    kitId: number,
    bayId: number,
    dto: { type: string; note?: string; operator?: string },
  ): Observable<any> {
    return this.post<any>(`production/lines/${kitId}/bays/${bayId}/incidents`, dto);
  }

  getProductionIncidents(kitId: number, bayId: number): Observable<any[]> {
    return this.get<any[]>(`production/lines/${kitId}/bays/${bayId}/incidents`);
  }

  getProductionMaterials(kitId: number): Observable<any[]> {
    return this.get<any[]>(`production/lines/${kitId}/materials`);
  }

  getProductionHourly(kitId: number): Observable<any[]> {
    return this.get<any[]>(`production/lines/${kitId}/hourly`);
  }

  getProductionCompleted(): Observable<any[]> {
    return this.get<any[]>('production/completed');
  }

  getProductionShortageRisk(kitId: number): Observable<any> {
    return this.get<any>(`production/lines/${kitId}/shortage-risk`);
  }

  getLogisticsShortageRisk(): Observable<any[]> {
    return this.get<any[]>('production/logistics/shortage-risk');
  }


  createForecastRun(dto: any): Observable<any> {
    return this.post<any>('decision-intelligence/forecast-runs', dto);
  }

  getForecastRuns(): Observable<any[]> {
    return this.get<any[]>('decision-intelligence/forecast-runs');
  }

  createPlanScenario(dto: any): Observable<any> {
    return this.post<any>('decision-intelligence/plan-scenarios', dto);
  }

  getPlanScenarios(): Observable<any[]> {
    return this.get<any[]>('decision-intelligence/plan-scenarios');
  }

  publishPlan(dto: any): Observable<any> {
    return this.post<any>('decision-intelligence/plan-publications', dto);
  }

  getPlanPublications(): Observable<any[]> {
    return this.get<any[]>('decision-intelligence/plan-publications');
  }

  getDecisionLogisticsPriority(runId?: number): Observable<any> {
    return this.get<any>('decision-intelligence/logistics-priority', runId ? { runId } : undefined);
  }

  runPlanScenarioSimulation(id: number, dto: any): Observable<any> {
    return this.post<any>(`decision-intelligence/plan-scenarios/${id}/simulate`, dto);
  }

  getPlanScenarioSimulation(id: number): Observable<any> {
    return this.get<any>(`decision-intelligence/plan-scenarios/${id}/simulation`);
  }

  registerPlanOutcome(publicationId: number, dto: any): Observable<any> {
    return this.post<any>(`decision-intelligence/plan-publications/${publicationId}/outcome`, dto);
  }

  getPlanControlTower(publicationId: number): Observable<any> {
    return this.get<any>(`decision-intelligence/plan-publications/${publicationId}/control-tower`);
  }

  getCalibrationSummary(): Observable<any> {
    return this.get<any>('decision-intelligence/calibration/summary');
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

  createCancellationRequest(dto: { publicationId: number; kitId?: number; requestedBy?: string }): Observable<any> {
    return this.post<any>('cancellation-requests', dto);
  }

  getPendingCancellationRequests(): Observable<any[]> {
    return this.get<any[]>('cancellation-requests/pending');
  }

  getRecentCancellationRequests(): Observable<any[]> {
    return this.get<any[]>('cancellation-requests/recent');
  }

  respondCancellationRequest(id: number, action: 'accept' | 'reject', respondedBy?: string): Observable<any> {
    return this.patch<any>(`cancellation-requests/${id}/respond`, { action, respondedBy });
  }

  private withFallback<T>(request: (base: string) => Observable<T>): Observable<T> {
    return request(this.base).pipe(
      catchError((err: HttpErrorResponse) => {
        if (err.status !== 0 || !this.sameOriginBase || this.sameOriginBase === this.base) {
          return throwError(() => err);
        }
        return request(this.sameOriginBase).pipe(
          tap(() => {
            this.base = this.sameOriginBase;
          }),
        );
      }),
    );
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

  private buildUrl(base: string, path: string): string {
    return `${base.replace(/\/+$/, '')}/${path.replace(/^\/+/, '')}`;
  }
}
