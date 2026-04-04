import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { DispositionItem } from './ie-data.models';
import { evaluateMiniMost } from './most-score.util';

@Injectable({ providedIn: 'root' })
export class DispositionService {
  private readonly store = new BehaviorSubject<DispositionItem[]>([
    this.createSeed('OP-320-0107B', 1, 'OP-520-0088', 'SCREW, PH, PHIL, SEMS, PLST, 4-40, 1/4', 5, 4, 2, 1, 1, 5),
    this.createSeed('OP-320-0107B', 1, 'OP-520-0091', 'SCREW, FLAT HEAD, 4-40 X 3/16', 4, 3, 2, 1, 1, 4),
    this.createSeed('OP-320-0107B', 2, 'OP-520-0097', 'WASHER, LOCK, FOR MOLEX BNC', 3, 2, 2, 1, 2, 3),
    this.createSeed('OP-320-0107B', 2, 'OP-520-0098', 'NUT, JAM, FOR MOLEX BNC', 3, 2, 3, 1, 2, 4),
  ]);

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

  private createSeed(
    model: string,
    bayId: number,
    partNumber: string,
    description: string,
    usageFrequency: number,
    picksPerCycle: number,
    handlingDifficulty: 1 | 2 | 3 | 4 | 5,
    weightCategory: 1 | 2 | 3 | 4 | 5,
    distanceCategory: 1 | 2 | 3 | 4 | 5,
    criticality: 1 | 2 | 3 | 4 | 5,
  ): DispositionItem {
    const most = evaluateMiniMost({ usageFrequency, picksPerCycle, handlingDifficulty, weightCategory, distanceCategory, criticality });
    return {
      id: `seed-${model}-${bayId}-${partNumber}`,
      model,
      bayId,
      partNumber,
      description,
      usageFrequency,
      picksPerCycle,
      handlingDifficulty,
      weightCategory,
      distanceCategory,
      criticality,
      notes: '',
      mostScore: most.score,
      recommendation: most.recommendation,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  }
}
