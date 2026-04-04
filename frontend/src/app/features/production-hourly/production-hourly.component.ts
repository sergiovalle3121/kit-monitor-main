import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { ProductionOpsService } from '../../core/production-ops.service';

@Component({
  selector: 'app-production-hourly',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './production-hourly.component.html',
  styleUrl: './production-hourly.component.css',
})
export class ProductionHourlyComponent {
  constructor(private readonly ops: ProductionOpsService) {}

  rows() {
    return this.ops.getHourlySeries();
  }
}
