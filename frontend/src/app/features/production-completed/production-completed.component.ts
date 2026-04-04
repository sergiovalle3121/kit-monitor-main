import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { ApiService } from '../../core/api.service';

@Component({
  selector: 'app-production-completed',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './production-completed.component.html',
  styleUrl: './production-completed.component.css',
})
export class ProductionCompletedComponent implements OnInit {
  rows: any[] = [];

  constructor(private readonly api: ApiService) {}

  ngOnInit(): void {
    this.api.getProductionCompleted().subscribe({
      next: (rows) => { this.rows = rows ?? []; },
      error: () => { this.rows = []; },
    });
  }
}
