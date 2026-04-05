import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, tap } from 'rxjs';
import { ApiService } from './api.service';
import { VisualAid } from './ie-data.models';

@Injectable({ providedIn: 'root' })
export class VisualAidsService {
  private readonly store = new BehaviorSubject<VisualAid[]>([]);

  constructor(private readonly api: ApiService) {}

  getVisualAids(): Observable<VisualAid[]> {
    return this.store.asObservable();
  }

  loadVisualAids(): Observable<VisualAid[]> {
    return this.api.getVisualAids().pipe(
      tap((items) => this.store.next(items ?? [])),
    );
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

  createVisualAid(input: Omit<VisualAid, 'id' | 'createdAt' | 'updatedAt'>): Observable<VisualAid> {
    return this.api.createVisualAid(input).pipe(
      tap((created) => this.store.next([created, ...this.store.value])),
    );
  }

  updateVisualAid(id: string, patch: Partial<VisualAid>): Observable<VisualAid> {
    return this.api.updateVisualAid(id, patch).pipe(
      tap((updated) => {
        this.store.next(this.store.value.map(item =>
          item.id === id ? { ...item, ...updated } : item,
        ));
      }),
    );
  }

  deleteVisualAid(id: string): Observable<{ deleted: boolean; id: string }> {
    return this.api.deleteVisualAid(id).pipe(
      tap(() => this.store.next(this.store.value.filter(item => item.id !== id))),
    );
  }
}
