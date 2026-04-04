import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DispositionService } from '../../core/disposition.service';
import { DispositionItem } from '../../core/ie-data.models';

@Component({
  selector: 'app-disposition',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './disposition.component.html',
  styleUrl: './disposition.component.css',
})
export class DispositionComponent implements OnInit {
  items: DispositionItem[] = [];
  modelFilter = 'OP-320-0107B';
  form = {
    model: 'OP-320-0107B',
    bayId: 1,
    partNumber: '',
    description: '',
    usageFrequency: 3,
    picksPerCycle: 2,
    handlingDifficulty: 2 as 1 | 2 | 3 | 4 | 5,
    weightCategory: 2 as 1 | 2 | 3 | 4 | 5,
    distanceCategory: 2 as 1 | 2 | 3 | 4 | 5,
    criticality: 3 as 1 | 2 | 3 | 4 | 5,
    notes: '',
  };

  constructor(private readonly disposition: DispositionService) {}

  ngOnInit(): void {
    this.disposition.getDisposition().subscribe(() => {
      this.refresh();
    });
  }

  refresh(): void {
    this.items = this.disposition.getDispositionByModel(this.modelFilter);
  }

  save(): void {
    this.disposition.upsertItem(this.form);
    this.form.partNumber = '';
    this.form.description = '';
    this.form.notes = '';
  }

  remove(id: string): void {
    this.disposition.removeItem(id);
  }

  bays(): Array<{ bay: number; items: DispositionItem[]; score: number }> {
    return [1, 2, 3, 4, 5, 6].map((bay) => {
      const bayItems = this.items.filter(item => item.bayId === bay);
      const score = bayItems.length
        ? Math.round(bayItems.reduce((acc, item) => acc + item.mostScore, 0) / bayItems.length)
        : 0;
      return { bay, items: bayItems, score };
    });
  }
}
