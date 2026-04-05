import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../core/api.service';
import { ConfirmModalService } from '../../shared/confirm-modal/confirm-modal.service';

interface PlanForm {
  model: string;
  backen: number;
  quantity: number;
  shift: string;
  scheduledAt: string;
}

@Component({
  selector: 'app-plan',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './plan.component.html',
  styleUrls: ['./plan.component.css'],
})
export class PlanComponent implements OnInit {
  plans: any[] = [];
  availableModels: string[] = [];

  loading = false;
  error: string | null = null;

  showForm = false;
  submitting = false;
  deletingPlanId: number | null = null;
  selectedPlanDetail: any | null = null;
  formError: string | null = null;

  readonly backens = [1, 2, 3, 4, 5, 6, 7];
  readonly shifts = ['T1', 'T2', 'T3'];

  form: PlanForm = this.createEmptyForm();

  constructor(
    private api: ApiService,
    private readonly confirmModal: ConfirmModalService,
  ) {}

  ngOnInit(): void {
    this.loadPlans();
    this.loadAvailableModels();
  }

  get generatedFolioPreview(): string {
    return this.nextNumericFolio();
  }

  get totalPlans(): number {
    return this.plans.length;
  }

  get pendingPlans(): number {
    return this.countPlansByStatus('pending');
  }

  get activePlans(): number {
    return this.countPlansByStatus('active');
  }

  get scheduledPlans(): number {
    return this.plans.filter((plan) => !!plan.scheduledAt).length;
  }

  toggleForm(): void {
    this.showForm = !this.showForm;
    this.formError = null;

    if (!this.showForm) {
      this.resetForm();
    }
  }

  loadPlans(): void {
    this.loading = true;
    this.error = null;

    this.api.getPlans().subscribe({
      next: (data) => {
        this.plans = data ?? [];
        this.loading = false;
      },
      error: () => {
        this.error = 'No se pudieron cargar las publicaciones de planeacion';
        this.loading = false;
      },
    });
  }

  loadAvailableModels(): void {
    this.api.getBom().subscribe({
      next: (items) => {
        const models = (items ?? [])
          .map((item) => this.normalizeModelValue(item.model))
          .filter((model) => model.startsWith('OP-'));

        this.availableModels = [...new Set(models)].sort((left, right) => left.localeCompare(right));
      },
      error: () => {
        this.availableModels = [];
      },
    });
  }

  onModelInput(value: string): void {
    this.form.model = this.normalizeModelValue(value);
  }

  submit(): void {
    if (this.submitting) return;

    const model = this.normalizeModelValue(this.form.model);
    if (!model.startsWith('OP-')) {
      this.formError = 'El modelo debe comenzar con OP-';
      return;
    }

    this.submitting = true;
    this.formError = null;

    const dto: any = {
      model,
      backen: this.form.backen,
      quantity: Number(this.form.quantity),
      shift: this.form.shift,
    };

    if (this.form.scheduledAt) dto.scheduledAt = this.form.scheduledAt;

    this.api.createPlan(dto).subscribe({
      next: (created) => {
        this.plans = [created, ...this.plans];
        this.submitting = false;
        this.showForm = false;
        this.resetForm();
      },
      error: (err) => {
        this.formError = this.extractMessage(err, 'Error al crear la publicacion');
        this.submitting = false;
      },
    });
  }

  async deletePlan(plan: any): Promise<void> {
    if (!this.canDelete(plan) || this.deletingPlanId !== null) return;

    if (plan.hasKit && plan.kitStatus !== 'cancelled') {
      const requestConfirm = await this.confirmModal.open({
        title: 'Solicitar cancelación de kit',
        message: `Este plan tiene el kit ${plan.workOrder} en proceso. Se enviará una solicitud al kitteador para que autorice la cancelación.`,
        confirmText: 'Enviar solicitud',
        type: 'neutral',
      });
      if (!requestConfirm) return;

      this.deletingPlanId = plan.id;
      this.error = null;
      this.api.createCancellationRequest({
        publicationId: plan.id,
        kitId: plan.kitId ?? undefined,
        requestedBy: 'planeacion',
      }).subscribe({
        next: () => {
          this.error = `Solicitud enviada para ${plan.workOrder}.`;
          this.deletingPlanId = null;
        },
        error: (err) => {
          this.error = this.extractMessage(err, 'No se pudo crear la solicitud de cancelación');
          this.deletingPlanId = null;
        },
      });
      return;
    }

    const confirmed = await this.confirmModal.open({
      title: '¿Estás seguro?',
      message: 'Esta acción no se puede deshacer.',
      confirmText: 'Borrar',
      type: 'destructive',
    });
    if (!confirmed) return;

    this.deletingPlanId = plan.id;
    this.error = null;

    this.api.deletePlan(plan.id).subscribe({
      next: () => {
        this.plans = this.plans.filter((item) => item.id !== plan.id);
        this.deletingPlanId = null;
      },
      error: (err) => {
        this.error = this.extractMessage(err, 'No se pudo borrar el plan');
        this.deletingPlanId = null;
      },
    });
  }

  openDetail(plan: any): void {
    this.selectedPlanDetail = plan;
  }

  closeDetail(): void {
    this.selectedPlanDetail = null;
  }

  canDelete(plan: any): boolean {
    return !!plan?.id;
  }

  planStatusLabel(status: string): string {
    const labels: Record<string, string> = {
      pending: 'Pendiente',
      active: 'Activo',
      completed: 'Completado',
      cancelled: 'Cancelado',
    };
    return labels[status] ?? status;
  }

  publicationSummary(plan: any): string {
    const parts = [`BK${plan.backen}`];

    parts.push(`${plan.quantity} uds`);
    parts.push(plan.shift);

    return parts.join(' - ');
  }

  createdLabel(plan: any): string {
    return this.formatDate(plan.createdAt);
  }

  scheduleLabel(plan: any): string {
    return plan.scheduledAt ? `Arranque ${this.formatDate(plan.scheduledAt)}` : 'Sin hora programada';
  }

  trackByPlanId(_index: number, plan: any): number {
    return plan.id;
  }

  private countPlansByStatus(status: string): number {
    return this.plans.filter((plan) => plan.status === status).length;
  }

  private resetForm(): void {
    this.form = this.createEmptyForm();
  }

  private createEmptyForm(): PlanForm {
    return {
      model: '',
      backen: 1,
      quantity: 1,
      shift: 'T1',
      scheduledAt: '',
    };
  }

  private normalizeModelValue(value: string | null | undefined): string {
    return (value ?? '').toUpperCase().replace(/\s+/g, '').trim();
  }

  private extractMessage(err: any, fallback: string): string {
    const message = err?.error?.message;
    if (Array.isArray(message)) return message.join(', ');
    return message ?? fallback;
  }

  private formatDate(value: string | Date): string {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return 'Sin fecha';

    return new Intl.DateTimeFormat('es-MX', {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(date);
  }

  private pad(value: number, size = 2): string {
    return String(value).padStart(size, '0');
  }

  private nextNumericFolio(): string {
    const highest = this.plans
      .map((plan) => String(plan.workOrder ?? '').trim())
      .filter((workOrder) => /^\d+$/.test(workOrder))
      .map((workOrder) => Number(workOrder))
      .reduce((max, current) => Math.max(max, current), 0);

    return this.pad(highest + 1, 5);
  }
}
