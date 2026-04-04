import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { VisualAid } from './ie-data.models';

const DEMO_PDF = 'data:application/pdf;base64,JVBERi0xLjQKMSAwIG9iago8PCAvVHlwZSAvQ2F0YWxvZyAvUGFnZXMgMiAwIFIgPj4KZW5kb2JqCjIgMCBvYmoKPDwgL1R5cGUgL1BhZ2VzIC9LaWRzIFsgMyAwIFIgXSAvQ291bnQgMSA+PgplbmRvYmoKMyAwIG9iago8PCAvVHlwZSAvUGFnZSAvUGFyZW50IDIgMCBSIC9NZWRpYUJveCBbMCAwIDMwMCAxNDQgXSAvQ29udGVudHMgNCAwIFIgL1Jlc291cmNlcyA8PCA+PiA+PgplbmRvYmoKNCAwIG9iago8PCAvTGVuZ3RoIDQ0ID4+CnN0cmVhbQpCVCAvRjEgMTIgVGYgNTAgODAgVGQgKEtpdCBNb25pdG9yIFZpc3VhbCBBaWQpIFRqIEVUCmVuZHN0cmVhbQplbmRvYmoKeHJlZgowIDUKMDAwMDAwMDAwMCA2NTUzNSBmIAowMDAwMDAwMDEwIDAwMDAwIG4gCjAwMDAwMDAwNjAgMDAwMDAgbiAKMDAwMDAwMDExNyAwMDAwMCBuIAowMDAwMDAwMjI2IDAwMDAwIG4gCnRyYWlsZXIKPDwgL1Jvb3QgMSAwIFIgL1NpemUgNSA+PgpzdGFydHhyZWYKMzI2CiUlRU9G';

@Injectable({ providedIn: 'root' })
export class VisualAidsService {
  private readonly store = new BehaviorSubject<VisualAid[]>([
    {
      id: 'va-demo-320',
      model: 'OP-320-0107B',
      title: 'Ayuda visual ensamble OP-320-0107B',
      process: 'Ensamble final',
      area: 'Línea BK3',
      revision: 'R3',
      pdfUrl: DEMO_PDF,
      isActive: true,
      notes: 'Documento demo para integración Producción/IE.',
      uploadedBy: 'IE',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  ]);

  getVisualAids(): Observable<VisualAid[]> {
    return this.store.asObservable();
  }

  getVisualAidsByModel(model: string): VisualAid[] {
    return this.store.value.filter(item => item.model.toUpperCase() === model.toUpperCase());
  }

  getActiveVisualAidByModel(model: string, process?: string): VisualAid | null {
    return this.store.value.find(item =>
      item.isActive
      && item.model.toUpperCase() === model.toUpperCase()
      && (!process || item.process.toLowerCase() === process.toLowerCase()),
    ) ?? null;
  }

  createVisualAid(input: Omit<VisualAid, 'id' | 'createdAt' | 'updatedAt'>): VisualAid {
    const next: VisualAid = {
      ...input,
      id: `va-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    this.store.next([next, ...this.store.value]);
    return next;
  }

  updateVisualAid(id: string, patch: Partial<VisualAid>): void {
    this.store.next(this.store.value.map(item =>
      item.id === id ? { ...item, ...patch, updatedAt: new Date().toISOString() } : item,
    ));
  }

  deactivateVisualAid(id: string): void {
    this.updateVisualAid(id, { isActive: false });
  }
}
