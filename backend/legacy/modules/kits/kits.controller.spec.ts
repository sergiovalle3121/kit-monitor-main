import { Injectable } from '@angular/core';
import { Observable, of } from 'rxjs';

export type Kit = { id: number; name: string; };

@Injectable({ providedIn: 'root' })
export class KitsService {
  getKits(): Observable<Kit[]> {
    // Aquí va tu lógica real, esto es solo un ejemplo:
    return of([{ id: 1, name: 'Kit 1' }]);
  }
}