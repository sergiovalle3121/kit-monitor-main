import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { ApiService } from '../../core/api.service';

@Component({
  selector: 'app-supplier-scorecard',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './supplier-scorecard.component.html',
  styleUrl: './supplier-scorecard.component.css'
})
export class SupplierScorecardComponent implements OnInit {
  loading = true;
  scorecards: any[] = [];
  selectedScorecard: any = null;

  constructor(private api: ApiService) {}

  ngOnInit() {
    this.loadScorecards();
  }

  loadScorecards() {
    this.loading = true;
    this.api.getSupplierScorecards().subscribe({
      next: (data) => {
        this.scorecards = data;
        this.loading = false;
      },
      error: () => this.loading = false
    });
  }

  viewDetail(scorecard: any) {
    this.selectedScorecard = scorecard;
  }

  getRiskClass(risk: string) {
    return risk.toLowerCase();
  }
}
