import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../core/api.service';

@Component({
  selector: 'app-replenishment-center',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './replenishment-center.component.html',
  styleUrl: './replenishment-center.component.css'
})
export class ReplenishmentCenterComponent implements OnInit {
  loading = true;
  signals: any[] = [];
  rules: any[] = [];
  showRuleModal = false;

  ruleForm = {
    warehouseId: '',
    partNumber: '',
    minStock: 0,
    maxStock: 0,
    preferredSourceWarehouseId: 'WH-MAIN',
    autoCreateTasks: true,
    priority: 'normal'
  };

  constructor(private api: ApiService) {}

  ngOnInit() {
    this.loadData();
  }

  loadData() {
    this.loading = true;
    this.api.analyzeReplenishment().subscribe({
      next: (data) => {
        this.signals = data;
        this.loading = false;
      },
      error: () => this.loading = false
    });
    this.api.getReplenishmentRules().subscribe(rules => this.rules = rules);
  }

  saveRule() {
    this.api.createReplenishmentRule(this.ruleForm).subscribe(() => {
      this.loadData();
      this.showRuleModal = false;
    });
  }

  getStatusClass(status: string) {
    return status.toLowerCase();
  }
}
