import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { ApiService } from '../../core/api.service';

@Component({
  selector: 'app-logistics-risk',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './logistics-risk.component.html',
  styleUrl: './logistics-risk.component.css',
})
export class LogisticsRiskComponent implements OnInit {
  rows: any[] = [];

  constructor(private readonly api: ApiService) {}

  ngOnInit(): void {
    this.api.getLogisticsShortageRisk().subscribe({
      next: (rows) => { this.rows = rows ?? []; },
      error: () => { this.rows = []; },
    });
  }
}
