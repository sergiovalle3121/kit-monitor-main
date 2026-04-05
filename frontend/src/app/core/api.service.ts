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

  getVisualAids(): Observable<any[]> {
    return this.get<any[]>('visual-aids');
  }

  createVisualAid(dto: any): Observable<any> {
    return this.post<any>('visual-aids', dto);
  }

  createVisualAidFormData(formData: FormData): Observable<any> {
    return this.http.post<any>(`${this.base}/visual-aids`, formData);
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


  getProductionBackends(): Observable<any[]> {
    return this.get<any[]>('production/backends');
  }

  getProductionBackend(kitId: number): Observable<any> {
    return this.get<any>(`production/backends/${kitId}`);
  }

  receiveProductionBackend(kitId: number): Observable<any> {
    return this.post<any>(`production/backends/${kitId}/receive`, {});
  }

  startProductionBackend(kitId: number): Observable<any> {
    return this.post<any>(`production/backends/${kitId}/start`, {});
  }

  createBayEvent(kitId: number, bayId: number, dto: { quantity: number; notes?: string; operator?: string }): Observable<any> {
    return this.post<any>(`production/backends/${kitId}/bays/${bayId}/events`, dto);
  }

  getProductionEvents(kitId: number): Observable<any[]> {
    return this.get<any[]>(`production/backends/${kitId}/events`);
  }

  getProductionMaterials(kitId: number): Observable<any[]> {
    return this.get<any[]>(`production/backends/${kitId}/materials`);
  }

  getProductionHourly(kitId: number): Observable<any[]> {
    return this.get<any[]>(`production/backends/${kitId}/hourly`);
  }

  getProductionCompleted(): Observable<any[]> {
    return this.get<any[]>('production/completed');
  }

  getProductionShortageRisk(kitId: number): Observable<any> {
    return this.get<any>(`production/backends/${kitId}/shortage-risk`);
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
}
