import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../core/api.service';

@Component({
  selector: 'app-plan',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './plan.component.html',
  styleUrls: ['./plan.component.css'],
})
export class PlanComponent implements OnInit {
  plans: any[] = [];
  loading = false;
  error: string | null = null;

  showForm = false;
  submitting = false;
  formError: string | null = null;

  form = {
    workOrder: '',
    model: '',
    backen: 1,
    bahia: 1,
    quantity: 1,
    shift: 'T1',
    scheduledAt: '',
    sequence: 0,
  };

  constructor(private api: ApiService) {}

  ngOnInit(): void {
    this.loadPlans();
  }

  loadPlans(): void {
    this.loading = true;
    this.api.getPlans().subscribe({
      next: (data) => { this.plans = data ?? []; this.loading = false; },
      error: () => { this.error = 'No se pudieron cargar los planes'; this.loading = false; },
    });
  }

  submit(): void {
    this.submitting = true;
    this.formError = null;
    const dto: any = { ...this.form };
    if (!dto.scheduledAt) delete dto.scheduledAt;

    this.api.createPlan(dto).subscribe({
      next: (created) => {
        this.plans = [created, ...this.plans];
        this.submitting = false;
        this.showForm = false;
        this.resetForm();
      },
      error: (err) => {
        this.formError = err?.error?.message ?? 'Error al crear el plan';
        this.submitting = false;
      },
    });
  }

  private resetForm(): void {
    this.form = { workOrder: '', model: '', backen: 1, bahia: 1,
                  quantity: 1, shift: 'T1', scheduledAt: '', sequence: 0 };
  }
}
