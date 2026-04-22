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

  createVisualAid(input: {
    model: string;
    title: string;
    process: string;
    area?: string;
    revision?: string;
    notes?: string;
    isActive?: boolean;
    uploadedBy?: string;
    annotations?: string;
  }, file: File): Observable<VisualAid> {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('model', input.model);
    formData.append('title', input.title);
    formData.append('process', input.process);
    formData.append('area', input.area ?? '');
    formData.append('revision', input.revision ?? '');
    formData.append('notes', input.notes ?? '');
    formData.append('uploadedBy', input.uploadedBy ?? '');
    formData.append('isActive', String(input.isActive ?? true));
    if (input.annotations) {
      formData.append('annotations', input.annotations);
    }

    return this.api.createVisualAidFormData(formData).pipe(
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
