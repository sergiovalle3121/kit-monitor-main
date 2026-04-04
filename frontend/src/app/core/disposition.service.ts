import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { DispositionItem } from './ie-data.models';
import { evaluateMiniMost } from './most-score.util';

@Injectable({ providedIn: 'root' })
export class DispositionService {
  private readonly store = new BehaviorSubject<DispositionItem[]>([]);

  getDisposition(): Observable<DispositionItem[]> {
    return this.store.asObservable();
  }

  getDispositionByModel(model: string): DispositionItem[] {
    return this.store.value
      .filter(item => item.model.toUpperCase() === model.toUpperCase())
      .sort((a, b) => a.bayId - b.bayId || a.partNumber.localeCompare(b.partNumber));
  }

  upsertItem(input: Omit<DispositionItem, 'id' | 'mostScore' | 'recommendation' | 'createdAt' | 'updatedAt'>, id?: string): void {
    const result = evaluateMiniMost(input);
    if (id) {
      this.store.next(this.store.value.map(item =>
        item.id === id
          ? { ...item, ...input, ...result, updatedAt: new Date().toISOString() }
          : item,
      ));
      return;
    }

    const next: DispositionItem = {
      ...input,
      id: `dp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      mostScore: result.score,
      recommendation: result.recommendation,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    this.store.next([next, ...this.store.value]);
  }

  removeItem(id: string): void {
    this.store.next(this.store.value.filter(item => item.id !== id));
  }
}
