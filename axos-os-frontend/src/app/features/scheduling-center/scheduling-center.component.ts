import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../core/api.service';

@Component({
  selector: 'app-scheduling-center',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './scheduling-center.component.html',
  styleUrl: './scheduling-center.component.css'
})
export class SchedulingCenterComponent implements OnInit {
  loading = true;
  backlog: any[] = [];
  intelligence: any = { lineLoad: [], readinessRisks: 0 };
  selectedPlan: any = null;

  constructor(private api: ApiService) {}

  ngOnInit() {
    this.loadData();
  }

  loadData() {
    this.loading = true;
    this.api.getPlans({}).subscribe(plans => {
      this.backlog = plans.filter((p: any) => p.status === 'pending');
      this.loading = false;
    });
    this.api.getSchedulingIntelligence().subscribe(intel => this.intelligence = intel);
  }

  releaseOrder(plan: any) {
    if (confirm(`Release Work Order ${plan.workOrder} to production?`)) {
      this.api.releaseWorkOrder(plan.id, 'Planner Agent 01').subscribe(() => {
        this.loadData();
      });
    }
  }

  getLoadClass(percent: number) {
    if (percent > 90) return 'overload';
    if (percent > 70) return 'warning';
    return 'optimal';
  }

  getPriorityClass(priority: string) {
    return priority?.toLowerCase() || 'normal';
  }
}
