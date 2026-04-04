import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { ProductionOpsService } from '../../core/production-ops.service';

@Component({
  selector: 'app-production-completed',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './production-completed.component.html',
  styleUrl: './production-completed.component.css',
})
export class ProductionCompletedComponent {
  constructor(private readonly ops: ProductionOpsService) {}

  rows() {
    return this.ops.getCompletedSummaries();
  }
}
