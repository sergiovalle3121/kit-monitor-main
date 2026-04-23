import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ApiService } from '../../core/api.service';
import { RouterModule } from '@angular/router';

@Component({
  selector: 'app-site-overview',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './site-overview.component.html',
  styleUrl: './site-overview.component.css'
})
export class SiteOverviewComponent implements OnInit {
  loading = true;
  data: any = null;

  constructor(private api: ApiService) {}

  ngOnInit() {
    this.loadOverview();
  }

  loadOverview() {
    this.loading = true;
    this.api.getSiteOverview().subscribe({
      next: (res) => {
        this.data = res;
        this.loading = false;
      },
      error: () => this.loading = false
    });
  }

  getHealthClass(score: number) {
    if (score >= 90) return 'excellent';
    if (score >= 75) return 'good';
    if (score >= 60) return 'warning';
    return 'critical';
  }
}
