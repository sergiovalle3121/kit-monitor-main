import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../core/api.service';

@Component({
  selector: 'app-production-wip',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './production-wip.component.html',
  styleUrl: './production-wip.component.css'
})
export class ProductionWipComponent implements OnInit {
  loading = true;
  wipList: any[] = [];
  
  constructor(private api: ApiService) {}

  ngOnInit() {
    this.loadWip();
  }

  loadWip() {
    this.loading = true;
    this.api.getProductionWip().subscribe({
      next: (data) => {
        this.wipList = data;
        this.loading = false;
      },
      error: () => this.loading = false
    });
  }

  getProgress(wip: any) {
    return Math.min(100, (wip.completedQty / wip.targetQty) * 100);
  }

  getStatusClass(status: string) {
    return status.toLowerCase();
  }
}
