import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { VisualAid } from './ie-data.models';

@Injectable({ providedIn: 'root' })
export class VisualAidsService {
  private readonly store = new BehaviorSubject<VisualAid[]>([]);

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
